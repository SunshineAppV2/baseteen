import 'dart:async';
import 'package:flutter/material.dart';
import 'package:firebase_database/firebase_database.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../../../core/theme/app_colors.dart';

class QuizArenaPage extends StatefulWidget {
  final String? guestUserName;
  final String? guestUserId;
  final String? quizPin;

  const QuizArenaPage({
    super.key,
    this.guestUserName,
    this.guestUserId,
    this.quizPin,
  });

  @override
  State<QuizArenaPage> createState() => _QuizArenaPageState();
}

class _QuizArenaPageState extends State<QuizArenaPage> {
  late final DatabaseReference _quizRef;
  StreamSubscription? _quizSubscription;
  
  Map<String, dynamic>? _quizData;
  int _timeLeft = 0;
  Timer? _timer;
  int? _selectedOption;
  bool _hasAnswered = false;
  int? _correctAnswer;
  bool _showResult = false;

  @override
  void initState() {
    super.initState();
    final path = widget.quizPin != null ? 'active_quizzes/${widget.quizPin}' : 'active_quizzes/main_event';
    _quizRef = FirebaseDatabase.instance.ref(path);
    _listenToQuiz();
  }

  void _listenToQuiz() {
    _quizSubscription = _quizRef.onValue.listen((event) {
      if (event.snapshot.value != null) {
        final data = Map<String, dynamic>.from(event.snapshot.value as Map);
        setState(() {
          _quizData = data;
          _showResult = data['showResults'] ?? false;
          
          if (data['status'] == 'in_progress') {
             final question = data['currentQuestion'];
             if (_correctAnswer != question['correctAnswer']) {
                _correctAnswer = question['correctAnswer'];
                _startTimer(question['timeLimit']);
             }
          }
        });
      }
    });
  }

  void _startTimer(int seconds) {
    _timer?.cancel();
    setState(() {
      _timeLeft = seconds;
      _hasAnswered = false;
      _selectedOption = null;
    });
    
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }
      setState(() {
        if (_timeLeft > 0) {
          _timeLeft--;
        } else {
          _timer?.cancel();
        }
      });
    });
  }

  void _sendAnswer(int index) {
    if (_hasAnswered || _timeLeft == 0 || _showResult) return;

    setState(() {
      _selectedOption = index;
      _hasAnswered = true;
    });

    final String userId = widget.guestUserId ?? FirebaseAuth.instance.currentUser?.uid ?? 'guest_user';
    final answerRef = _quizRef.child('answers').child(_quizData!['currentQuestion']['id']).child(userId);
    
    answerRef.set({
      'selectedOption': index,
      'timestamp': DateTime.now().millisecondsSinceEpoch,
      'isCorrect': index == _correctAnswer,
      'userName': widget.guestUserName ?? FirebaseAuth.instance.currentUser?.displayName ?? 'Convidado',
    });
  }

  @override
  void dispose() {
    _quizSubscription?.cancel();
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_quizData == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    final String status = _quizData!['status'];

    return Scaffold(
      backgroundColor: status == 'in_progress' && _showResult 
        ? (_selectedOption == _correctAnswer ? AppColors.success : AppColors.error)
        : AppColors.primary,
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
                child: _buildBody(status),
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
            icon: const Icon(Icons.close, color: Colors.white),
          ),
          const Text(
            'ARENA QUIZ',
            style: TextStyle(
              color: Colors.white,
              fontSize: 18,
              fontWeight: FontWeight.bold,
              letterSpacing: 2,
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.2),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: [
                const Icon(Icons.timer_rounded, color: Colors.white, size: 16),
                const SizedBox(width: 4),
                Text(
                  '${_timeLeft}s',
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBody(String status) {
    if (status == 'waiting') {
      return Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.groups_rounded, size: 80, color: AppColors.primary),
          const SizedBox(height: 24),
          const Text(
            'Aguardando Início...',
            style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 12),
          const Text(
            'O coordenador iniciará o quiz em breve.\nPrepare seus conhecimentos!',
            textAlign: TextAlign.center,
            style: TextStyle(color: AppColors.textSecondary),
          ),
          const SizedBox(height: 32),
          const LinearProgressIndicator(),
        ],
      );
    }

    if (status == 'finished') {
      final List leaderboard = _quizData!['leaderboard'] ?? [];

      return Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.emoji_events_rounded, size: 80, color: Colors.orange),
          const SizedBox(height: 16),
          const Text(
            'PÓDIO DA ARENA',
            style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, letterSpacing: 1.5),
          ),
          const SizedBox(height: 32),
          if (leaderboard.isNotEmpty)
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                if (leaderboard.length > 1) _buildPodiumItem(leaderboard[1], 2, 80),
                _buildPodiumItem(leaderboard[0], 1, 120),
                if (leaderboard.length > 2) _buildPodiumItem(leaderboard[2], 3, 60),
              ],
            )
          else
            const Text('Nenhuma pontuação registrada.'),
          const SizedBox(height: 48),
          ElevatedButton(
            onPressed: () => Navigator.pop(context),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              minimumSize: const Size(double.infinity, 56),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            ),
            child: const Text('VOLTAR AO DASHBOARD', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
          ),
        ],
      );
    }

    final question = _quizData!['currentQuestion'];
    final alternatives = List<String>.from(question['alternatives']);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (_showResult)
          Center(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              decoration: BoxDecoration(
                color: _selectedOption == _correctAnswer ? AppColors.success : AppColors.error,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                _selectedOption == _correctAnswer ? 'CORRETO!' : 'INCORRETO!',
                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
              ),
            ),
          ),
        const SizedBox(height: 16),
        Text(
          'QUESTÃO ${_quizData!['currentQuestionIndex'] + 1}',
          style: const TextStyle(
            color: AppColors.primary,
            fontWeight: FontWeight.bold,
            letterSpacing: 1.2,
          ),
        ),
        const SizedBox(height: 12),
        Text(
          question['statement'],
          style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 32),
        Expanded(
          child: GridView.builder(
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              crossAxisSpacing: 16,
              mainAxisSpacing: 16,
              childAspectRatio: 1.0, 
            ),
            itemCount: alternatives.length,
            itemBuilder: (context, index) {
              final isSelected = _selectedOption == index;
              final isCorrect = _correctAnswer == index;
              
              final List<Color> altColors = [
                AppColors.error,    // A - Red
                AppColors.primary,  // B - Blue
                AppColors.warning,  // C - Yellow
                AppColors.success,  // D - Green
              ];

              Color altColor = altColors[index % altColors.length];
              Color bgColor = altColor;

              if (_showResult) {
                if (!isCorrect && !isSelected) {
                   bgColor = altColor.withOpacity(0.2);
                }
              } else if (_hasAnswered && !isSelected) {
                  bgColor = altColor.withOpacity(0.5);
              }

              return InkWell(
                onTap: _hasAnswered || _timeLeft == 0 || _showResult ? null : () => _sendAnswer(index),
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: bgColor,
                    borderRadius: BorderRadius.circular(24),
                    boxShadow: isSelected ? [
                      BoxShadow(color: altColor.withOpacity(0.4), blurRadius: 10, offset: const Offset(0, 4))
                    ] : [],
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Container(
                        width: 36,
                        height: 36,
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.2),
                          shape: BoxShape.circle,
                          border: isSelected ? Border.all(color: Colors.white, width: 2) : null,
                        ),
                        child: Center(
                          child: Text(
                            String.fromCharCode(65 + index),
                            style: const TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 18,
                              color: Colors.white,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 8),
                      Expanded(
                        child: Center(
                          child: Text(
                            alternatives[index],
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.bold,
                              color: Colors.white,
                            ),
                          ),
                        ),
                      ),
                      if (isSelected || (_showResult && isCorrect)) 
                        const Icon(Icons.check_circle, color: Colors.white, size: 20),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _buildPodiumItem(Map data, int rank, double height) {
    Color podiumColor = rank == 1 ? Colors.orange : (rank == 2 ? Colors.grey[400]! : Colors.brown[400]!);
    
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8.0),
      child: Column(
        children: [
          Text(
            data['name'],
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
          ),
          const SizedBox(height: 4),
          Text(
            '${data['score']} XP',
            style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold, fontSize: 10),
          ),
          const SizedBox(height: 8),
          Container(
            width: 60,
            height: height,
            decoration: BoxDecoration(
              color: podiumColor,
              borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(12),
                topRight: Radius.circular(12),
              ),
              boxShadow: [
                BoxShadow(
                  color: podiumColor.withOpacity(0.3),
                  blurRadius: 10,
                  offset: const Offset(0, 4),
                )
              ],
            ),
            child: Center(
              child: Text(
                rank.toString(),
                style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
