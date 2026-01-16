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
  bool _showLeaderboard = false;

  @override
  void initState() {
    super.initState();
    final path = widget.quizPin != null ? 'active_quizzes/${widget.quizPin}' : 'active_quizzes/main_event';
    _quizRef = FirebaseDatabase.instance.ref(path);
    _listenToQuiz();
  }

  void _listenToQuiz() {
    // Register participant
    _registerParticipant();
    
    _quizSubscription = _quizRef.onValue.listen((event) {
      if (event.snapshot.value != null) {
        final data = Map<String, dynamic>.from(event.snapshot.value as Map);
        if (mounted) {
          setState(() {
            _quizData = data;
            _showResult = data['showResults'] ?? false;
            _showLeaderboard = data['showLeaderboard'] ?? false;
            
            if (data['status'] == 'in_progress') {
              final question = data['currentQuestion'];
              if (question != null && _correctAnswer != question['correctAnswer']) {
                _correctAnswer = question['correctAnswer'];
                _startTimer(question['timeLimit'] ?? 30);
                _answerStats = {}; // Reset for new question
                _totalAnswersForQuestion = 0;
              }
            }
          });
        }
      }
    });
  }
  
  void _registerParticipant() {
    final String userId = widget.guestUserId ?? FirebaseAuth.instance.currentUser?.uid ?? 'guest_${DateTime.now().millisecondsSinceEpoch}';
    _quizRef.child('participants').child(userId).set({
      'name': widget.guestUserName ?? FirebaseAuth.instance.currentUser?.displayName ?? 'Convidado',
      'lastSeen': ServerValue.timestamp,
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

  Map<String, int> _answerStats = {};
  int _totalAnswersForQuestion = 0;
  StreamSubscription? _answersSubscription;

  void _listenToAnswers(String questionId) {
    _answersSubscription?.cancel();
    _answersSubscription = _quizRef.child('answers').child(questionId).onValue.listen((event) {
      if (event.snapshot.value != null) {
        final data = Map<String, dynamic>.from(event.snapshot.value as Map);
        final newStats = <String, int>{};
        int total = 0;
        data.forEach((userId, ansData) {
          final ans = Map<String, dynamic>.from(ansData as Map);
          final opt = ans['answerIdx']?.toString() ?? ans['selectedOption']?.toString();
          if (opt != null) {
            newStats[opt] = (newStats[opt] ?? 0) + 1;
            total++;
          }
        });
        if (mounted) {
          setState(() {
            _answerStats = newStats;
            _totalAnswersForQuestion = total;
          });
        }
      }
    });
  }

  @override
  void dispose() {
    _quizSubscription?.cancel();
    _answersSubscription?.cancel();
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_quizData == null) {
      return const Scaffold(backgroundColor: Color(0xFF0F172A), body: Center(child: CircularProgressIndicator()));
    }

    final String status = _quizData!['status'] ?? 'idle';

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      body: Stack(
        children: [
          // Background Blobs
          Positioned(
            top: -100,
            left: -100,
            child: Container(
              width: 300,
              height: 300,
              decoration: BoxDecoration(
                color: AppColors.primary.withOpacity(0.1),
                shape: BoxShape.circle,
              ),
            ),
          ),
          Positioned(
            bottom: -50,
            right: -50,
            child: Container(
              width: 250,
              height: 250,
              decoration: BoxDecoration(
                color: Colors.purple.withOpacity(0.05),
                shape: BoxShape.circle,
              ),
            ),
          ),
          
          SafeArea(
            child: Column(
              children: [
                _buildHeader(),
                Expanded(
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
                    decoration: const BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.only(
                        topLeft: Radius.circular(40),
                        topRight: Radius.circular(40),
                      ),
                    ),
                    child: ClipRRect(
                      borderRadius: const BorderRadius.only(
                        topLeft: Radius.circular(40),
                        topRight: Radius.circular(40),
                      ),
                      child: SingleChildScrollView(
                        physics: const BouncingScrollPhysics(),
                        child: _buildBody(status),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHeader() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
      child: Row(
        children: [
          IconButton(
            onPressed: () => Navigator.pop(context),
            icon: const Icon(Icons.close_rounded, color: Colors.white, size: 28),
          ),
          const Expanded(
            child: Center(
              child: Text(
                'ÁREA AO VIVO',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 20,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 3,
                ),
              ),
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            decoration: BoxDecoration(
              color: _timeLeft <= 5 && _timeLeft > 0 ? Colors.red : Colors.white.withOpacity(0.1),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.white.withOpacity(0.1)),
            ),
            child: Row(
              children: [
                Icon(Icons.timer_outlined, color: Colors.white, size: 18, color: _timeLeft <= 5 ? Colors.white : Colors.white70),
                const SizedBox(width: 6),
                Text(
                  '${_timeLeft}s',
                  style: TextStyle(
                    color: Colors.white, 
                    fontWeight: FontWeight.w900,
                    fontSize: 16,
                  ),
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
        mainAxisSize: MainAxisSize.min,
        children: [
          const SizedBox(height: 60),
          Container(
            padding: const EdgeInsets.all(32),
            decoration: BoxDecoration(
              color: AppColors.primary.withOpacity(0.05),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.sensors_rounded, size: 100, color: AppColors.primary),
          ),
          const SizedBox(height: 40),
          const Text(
            'Sintonizando ÁREA...',
            style: TextStyle(fontSize: 28, fontWeight: FontWeight.w900, color: Color(0xFF1E293B)),
          ),
          const SizedBox(height: 16),
          const Text(
            'Aguarde o comando do coordenador.\no desafio está prestes a começar!',
            textAlign: TextAlign.center,
            style: TextStyle(color: Colors.black54, fontSize: 16, height: 1.5),
          ),
          const SizedBox(height: 60),
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 40),
            child: LinearProgressIndicator(
              minHeight: 8,
              borderRadius: BorderRadius.all(Radius.circular(10)),
              backgroundColor: Color(0xFFF1F5F9),
              valueColor: AlwaysStoppedAnimation<Color>(AppColors.primary),
            ),
          ),
        ],
      );
    }

    if (status == 'finished' || _showLeaderboard) {
       return _buildFinishedState();
    }

    final question = _quizData!['currentQuestion'] ?? {};
    final alternatives = List<String>.from(question['alternatives'] ?? []);
    final String questionId = question['id'];

    if (_showResult && _answerStats.isEmpty) {
       _listenToAnswers(questionId);
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: AppColors.primary.withOpacity(0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(
                'QUESTÃO ${_quizData!['currentQuestionIndex'] + 1}',
                style: const TextStyle(
                  color: AppColors.primary,
                  fontWeight: FontWeight.w900,
                  fontSize: 12,
                  letterSpacing: 1,
                ),
              ),
            ),
            if (!_showResult && _hasAnswered)
               const Text('Resposta enviada!', style: TextStyle(color: Colors.green, fontWeight: FontWeight.bold, fontSize: 12)),
          ],
        ),
        const SizedBox(height: 20),
        Text(
          question['statement'] ?? '...',
          style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w900, color: Color(0xFF0F172A), height: 1.2),
        ),
        const SizedBox(height: 40),
        Column(
          children: List.generate(alternatives.length, (index) {
            final isSelected = _selectedOption == index;
            final isCorrect = _correctAnswer == index;
            
            final List<Color> altColors = [
              const Color(0xFFEF4444), // Red
              const Color(0xFF3B82F6), // Blue
              const Color(0xFFF59E0B), // Yellow
              const Color(0xFF10B981), // Green
            ];

            Color color = altColors[index % altColors.length];
            
            Widget? suffix;
            double percentage = 0;
            if (_showResult) {
              final count = _answerStats[index.toString()] ?? 0;
              percentage = _totalAnswersForQuestion > 0 ? (count / _totalAnswersForQuestion) : 0;
              
              if (isCorrect) {
                suffix = const Icon(Icons.check_circle_rounded, color: Colors.white, size: 28);
              } else if (isSelected) {
                suffix = const Icon(Icons.cancel_rounded, color: Colors.white, size: 28);
              }
            }

            return Padding(
              padding: const EdgeInsets.only(bottom: 16),
              child: InkWell(
                onTap: _hasAnswered || _timeLeft == 0 || _showResult ? null : () => _sendAnswer(index),
                borderRadius: BorderRadius.circular(24),
                child: Container(
                  height: 80,
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  decoration: BoxDecoration(
                    color: _showResult 
                        ? (isCorrect ? color : Colors.grey.withOpacity(0.1))
                        : (isSelected ? color : Colors.white),
                    borderRadius: BorderRadius.circular(24),
                    border: Border.all(
                      color: _showResult 
                          ? (isCorrect ? color : Colors.black.withOpacity(0.05))
                          : (isSelected ? color : Colors.black.withOpacity(0.05)),
                      width: 2,
                    ),
                    boxShadow: isSelected ? [
                      BoxShadow(color: color.withOpacity(0.3), blurRadius: 15, offset: const Offset(0, 8))
                    ] : [],
                  ),
                  child: Stack(
                    children: [
                      // Percentage Fill
                      if (_showResult)
                        Positioned.fill(
                          child: FractionallySizedBox(
                            alignment: Alignment.centerLeft,
                            widthFactor: percentage,
                            child: Container(
                              decoration: BoxDecoration(
                                color: isCorrect ? Colors.white.withOpacity(0.2) : color.withOpacity(0.15),
                                borderRadius: BorderRadius.circular(22),
                              ),
                            ),
                          ),
                        ),
                      
                      Row(
                        children: [
                          Container(
                            width: 44,
                            height: 44,
                            decoration: BoxDecoration(
                              color: (_showResult && isCorrect) || isSelected ? Colors.white.withOpacity(0.2) : color.withOpacity(0.1),
                              borderRadius: BorderRadius.circular(14),
                            ),
                            child: Center(
                              child: Text(
                                String.fromCharCode(65 + index),
                                style: TextStyle(
                                  fontWeight: FontWeight.w900,
                                  fontSize: 20,
                                  color: (_showResult && isCorrect) || isSelected ? Colors.white : color,
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 16),
                          Expanded(
                            child: Text(
                              alternatives[index],
                              style: TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.w800,
                                color: (_showResult && isCorrect) || isSelected ? Colors.white : const Color(0xFF1E293B),
                              ),
                            ),
                          ),
                          if (_showResult)
                            Padding(
                              padding: const EdgeInsets.only(left: 8),
                              child: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                crossAxisAlignment: CrossAxisAlignment.end,
                                children: [
                                  Text(
                                    '${(percentage * 100).round()}%',
                                    style: TextStyle(
                                      fontWeight: FontWeight.w900,
                                      fontSize: 18,
                                      color: isCorrect || isSelected ? Colors.white : color,
                                    ),
                                  ),
                                  if (suffix != null) suffix,
                                ],
                              ),
                            )
                          else if (isSelected)
                            const Icon(Icons.radio_button_checked_rounded, color: Colors.white, size: 28),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            );
          }),
        ),
        const SizedBox(height: 20),
      ],
    );
  }

  Widget _buildFinishedState() {
     final List leaderboard = _quizData!['leaderboard'] ?? [];

      return Column(
        children: [
          const SizedBox(height: 40),
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: Colors.amber.withOpacity(0.1),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.emoji_events_rounded, size: 80, color: Colors.amber),
          ),
          const SizedBox(height: 24),
          const Text(
            'HALL DA FAMA',
            style: TextStyle(fontSize: 32, fontWeight: FontWeight.w900, letterSpacing: 2, color: Color(0xFF0F172A)),
          ),
          const SizedBox(height: 40),
          if (leaderboard.isNotEmpty)
            Container(
              padding: const EdgeInsets.all(8),
              height: 300,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  if (leaderboard.length > 1) _buildPodiumItem(leaderboard[1], 2, 140),
                  _buildPodiumItem(leaderboard[0], 1, 180),
                  if (leaderboard.length > 2) _buildPodiumItem(leaderboard[2], 3, 110),
                ],
              ),
            )
          else
            const Text('Nenhum dado de pontuação disponível.'),
          
          const SizedBox(height: 60),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: ElevatedButton(
              onPressed: () => Navigator.pop(context),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF0F172A),
                minimumSize: const Size(double.infinity, 64),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                elevation: 10,
                shadowColor: const Color(0xFF0F172A).withOpacity(0.4),
              ),
              child: const Text(
                'ENCERRAR MISSÃO', 
                style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 18, letterSpacing: 1)
              ),
            ),
          ),
          const SizedBox(height: 40),
        ],
      );
  }

  Widget _buildPodiumItem(Map data, int rank, double height) {
    Color podiumColor = rank == 1 ? Colors.amber : (rank == 2 ? const Color(0xFFCBD5E1) : const Color(0xFFD97706));
    
    return Expanded(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 6.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.end,
          children: [
            Container(
              padding: const EdgeInsets.all(4),
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(color: podiumColor, width: 3),
              ),
              child: CircleAvatar(
                radius: 20,
                backgroundColor: podiumColor.withOpacity(0.2),
                child: Text(
                  data['name'][0].toUpperCase(),
                  style: TextStyle(color: podiumColor, fontWeight: FontWeight.w900),
                ),
              ),
            ),
            const SizedBox(height: 8),
            Text(
              data['name'].toString().split(' ')[0],
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13, color: Color(0xFF1E293B)),
            ),
            Text(
              '${data['score']} XP',
              style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.w900, fontSize: 12),
            ),
            const SizedBox(height: 12),
            Container(
              width: double.infinity,
              height: height,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [podiumColor, podiumColor.withOpacity(0.7)],
                ),
                borderRadius: const BorderRadius.only(
                  topLeft: Radius.circular(20),
                  topRight: Radius.circular(20),
                ),
                boxShadow: [
                  BoxShadow(
                    color: podiumColor.withOpacity(0.3),
                    blurRadius: 15,
                    offset: const Offset(0, 5),
                  )
                ],
              ),
              child: Stack(
                alignment: Alignment.center,
                children: [
                  Positioned(
                    top: 15,
                    child: Text(
                      rank.toString(),
                      style: const TextStyle(color: Colors.white, fontSize: 36, fontWeight: FontWeight.w900),
                    ),
                  ),
                  if (rank == 1)
                    const Positioned(
                      top: -10,
                      child: Icon(Icons.star_rounded, color: Colors.white, size: 24),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
