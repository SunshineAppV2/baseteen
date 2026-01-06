import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../../../core/theme/app_colors.dart';

class IndividualQuizPage extends StatefulWidget {
  final Map<String, dynamic> quiz;
  final String quizId;

  const IndividualQuizPage({
    super.key,
    required this.quiz,
    required this.quizId,
  });

  @override
  State<IndividualQuizPage> createState() => _IndividualQuizPageState();
}

class _IndividualQuizPageState extends State<IndividualQuizPage> {
  int _currentQuestionIndex = 0;
  int _score = 0;
  int? _selectedOption;
  bool _answered = false;
  bool _finished = false;
  bool _isSaving = false;

  late List<dynamic> _questions;

  @override
  void initState() {
    super.initState();
    _questions = widget.quiz['questions'] ?? [];
  }

  void _submitAnswer(int index) {
    if (_answered) return;

    final question = _questions[_currentQuestionIndex];
    final isCorrect = index == question['correctAnswer'];

    setState(() {
      _selectedOption = index;
      _answered = true;
      if (isCorrect) {
        _score += (question['xpValue'] as num? ?? 100).toInt();
      }
    });
  }

  void _nextQuestion() {
    if (_currentQuestionIndex < _questions.length - 1) {
      setState(() {
        _currentQuestionIndex++;
        _selectedOption = null;
        _answered = false;
      });
    } else {
      _finishQuiz();
    }
  }

  Future<void> _finishQuiz() async {
    setState(() {
      _finished = true;
      _isSaving = true;
    });

    final user = FirebaseAuth.instance.currentUser;
    if (user != null && _score > 0) {
      try {
        final userRef = FirebaseFirestore.instance.collection('users').doc(user.uid);
        
        // Atomic update
        await userRef.update({
          'xp': FieldValue.increment(_score),
          'stats.currentXp': FieldValue.increment(_score),
        });

        // XP History
        await userRef.collection('xp_history').add({
          'amount': _score,
          'type': 'quiz',
          'taskTitle': 'Quiz Individual: ${widget.quiz['title']}',
          'createdAt': FieldValue.serverTimestamp(),
          'reason': 'Finalizou o quiz "${widget.quiz['title']}" no modo individual.',
        });

        // Optional: Record attempts to prevent double dipping if desired, 
        // but for now let's just allow it or rely on business logic.
      } catch (e) {
        debugPrint('Error saving XP: $e');
      }
    }

    setState(() {
      _isSaving = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_finished) {
      return _buildFinishScreen();
    }

    if (_questions.isEmpty) {
      return Scaffold(
        appBar: AppBar(title: Text(widget.quiz['title'] ?? 'Quiz')),
        body: const Center(child: Text('Este quiz não possui questões.')),
      );
    }

    final question = _questions[_currentQuestionIndex];
    final alternatives = List<dynamic>.from(question['alternatives'] ?? []);

    return Scaffold(
      backgroundColor: AppColors.primary,
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(),
            Expanded(
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.all(24),
                decoration: const BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.only(
                    topLeft: Radius.circular(32),
                    topRight: Radius.circular(32),
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'QUESTÃO ${_currentQuestionIndex + 1} DE ${_questions.length}',
                      style: const TextStyle(
                        color: AppColors.primary,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 1.2,
                      ),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      question['statement'] ?? '',
                      style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 32),
                    Expanded(
                      child: ListView.separated(
                        itemCount: alternatives.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 12),
                        itemBuilder: (context, index) {
                          final alt = alternatives[index];
                          final isSelected = _selectedOption == index;
                          final isCorrect = question['correctAnswer'] == index;

                          Color bgColor = Colors.white;
                          Color textColor = AppColors.textPrimary;
                          BorderSide borderSide = BorderSide(color: Colors.grey.withOpacity(0.2));

                          if (_answered) {
                            if (isCorrect) {
                              bgColor = Colors.green.shade50;
                              textColor = Colors.green.shade700;
                              borderSide = BorderSide(color: Colors.green.shade300, width: 2);
                            } else if (isSelected) {
                              bgColor = Colors.red.shade50;
                              textColor = Colors.red.shade700;
                              borderSide = BorderSide(color: Colors.red.shade300, width: 2);
                            }
                          } else if (isSelected) {
                            bgColor = AppColors.primary.withOpacity(0.05);
                            borderSide = const BorderSide(color: AppColors.primary, width: 2);
                          }

                          return InkWell(
                            onTap: () => _submitAnswer(index),
                            borderRadius: BorderRadius.circular(16),
                            child: AnimatedContainer(
                              duration: const Duration(milliseconds: 200),
                              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                              decoration: BoxDecoration(
                                color: bgColor,
                                borderRadius: BorderRadius.circular(16),
                                border: Border.fromBorderSide(borderSide),
                              ),
                              child: Row(
                                children: [
                                  Container(
                                    width: 32,
                                    height: 32,
                                    decoration: BoxDecoration(
                                      color: isSelected ? AppColors.primary : Colors.grey.shade100,
                                      shape: BoxShape.circle,
                                    ),
                                    child: Center(
                                      child: Text(
                                        String.fromCharCode(65 + index),
                                        style: TextStyle(
                                          fontWeight: FontWeight.bold,
                                          color: isSelected ? Colors.white : Colors.grey.shade600,
                                        ),
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 16),
                                  Expanded(
                                    child: Text(
                                      alt is Map ? (alt['text'] ?? '') : alt.toString(),
                                      style: TextStyle(
                                        fontSize: 16,
                                        fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                                        color: textColor,
                                      ),
                                    ),
                                  ),
                                  if (_answered && isCorrect)
                                    const Icon(Icons.check_circle, color: Colors.green),
                                  if (_answered && isSelected && !isCorrect)
                                    const Icon(Icons.cancel, color: Colors.red),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
                    ),
                    if (_answered)
                      Padding(
                        padding: const EdgeInsets.only(top: 24),
                        child: SizedBox(
                          width: double.infinity,
                          child: ElevatedButton(
                            onPressed: _nextQuestion,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.primary,
                              padding: const EdgeInsets.symmetric(vertical: 16),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                            ),
                            child: Text(
                              _currentQuestionIndex < _questions.length - 1 ? 'PRÓXIMA PERGUNTA' : 'FINALIZAR QUIZ',
                              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Padding(
      padding: const EdgeInsets.all(24.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          IconButton(
            onPressed: () => Navigator.pop(context),
            icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Colors.white, size: 20),
          ),
          Text(
            widget.quiz['title']?.toUpperCase() ?? 'QUIZ',
            style: const TextStyle(
              color: Colors.white,
              fontSize: 14,
              fontWeight: FontWeight.bold,
              letterSpacing: 2,
            ),
          ),
          const SizedBox(width: 40), // Balance the back button
        ],
      ),
    );
  }

  Widget _buildFinishScreen() {
    return Scaffold(
      backgroundColor: Colors.white,
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(32.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.emoji_events_rounded, size: 100, color: Colors.orange),
              const SizedBox(height: 24),
              const Text(
                'Parabéns!',
                style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              Text(
                'Você completou o quiz individual.',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.grey.shade600, fontSize: 16),
              ),
              const SizedBox(height: 40),
              Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: AppColors.primary.withOpacity(0.05),
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(color: AppColors.primary.withOpacity(0.1)),
                ),
                child: Column(
                  children: [
                    const Text('VOCÊ GANHOU', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.textSecondary)),
                    const SizedBox(height: 8),
                    Text(
                      '$_score XP',
                      style: const TextStyle(fontSize: 48, fontWeight: FontWeight.bold, color: AppColors.primary),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 48),
              if (_isSaving)
                const CircularProgressIndicator()
              else
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: () => Navigator.pop(context),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    ),
                    child: const Text('VOLTAR AO PAINEL', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
