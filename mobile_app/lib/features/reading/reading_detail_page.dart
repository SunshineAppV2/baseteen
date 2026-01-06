import 'dart:async';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';

class ReadingDetailPage extends StatefulWidget {
  final Map<String, dynamic> meta;

  const ReadingDetailPage({super.key, required this.meta});

  @override
  State<ReadingDetailPage> createState() => _ReadingDetailPageState();
}

class _ReadingDetailPageState extends State<ReadingDetailPage> with WidgetsBindingObserver {
  final user = FirebaseAuth.instance.currentUser;
  bool _isReading = false;
  int _currentChapter = 0;
  int _secondsElapsed = 0;
  Timer? _timer;
  
  // Progress state
  List<int> _completedChapters = [];
  bool _isLoading = true;

  // Constants
  static const int secondsPerChapter = 120; // 2 minutes per chapter estimative
  
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _loadProgress();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _timer?.cancel();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused || state == AppLifecycleState.inactive) {
      if (_isReading) {
        _stopReading(reset: true);
        if (mounted) {
          Navigator.of(context).pop();
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Foco interrompido! Você saiu do aplicativo.'),
              backgroundColor: AppColors.error,
            ),
          );
        }
      }
    }
  }

  Future<void> _loadProgress() async {
    try {
      final doc = await FirebaseFirestore.instance
          .collection('users')
          .doc(user?.uid)
          .collection('reading_progress')
          .doc(widget.meta['id'])
          .get();

      if (doc.exists) {
        final data = doc.data() as Map<String, dynamic>;
        setState(() {
          _completedChapters = List<int>.from(data['completedChapters'] ?? []);
          _isLoading = false;
        });
      } else {
        setState(() => _isLoading = false);
      }
    } catch (e) {
      setState(() => _isLoading = false);
    }
  }

  void _startReading(int chapter) {
    setState(() {
      _isReading = true;
      _currentChapter = chapter;
      _secondsElapsed = 0;
    });

    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      setState(() {
        _secondsElapsed++;
      });
    });
  }

  void _stopReading({bool reset = false}) {
    _timer?.cancel();
    setState(() {
      _isReading = false;
      if (reset) {
        _secondsElapsed = 0;
        _currentChapter = 0;
      }
    });
  }

  Future<void> _completeChapter() async {
    final targetSeconds = (secondsPerChapter * 0.9).toInt();
    if (_secondsElapsed < targetSeconds) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Mantenha o foco! Faltam ${targetSeconds - _secondsElapsed} segundos.'),
          backgroundColor: AppColors.warning,
        ),
      );
      return;
    }

    final newCompleted = [..._completedChapters, _currentChapter];
    _stopReading();

    try {
      final batch = FirebaseFirestore.instance.batch();
      final progressRef = FirebaseFirestore.instance
          .collection('users')
          .doc(user?.uid)
          .collection('reading_progress')
          .doc(widget.meta['id']);

      batch.set(progressRef, {
        'completedChapters': newCompleted,
        'lastUpdated': FieldValue.serverTimestamp(),
        'planTitle': widget.meta['title'],
        'totalChapters': widget.meta['chapters'],
      });

      // If all chapters completed, award XP
      if (newCompleted.length == widget.meta['chapters']) {
        final userRef = FirebaseFirestore.instance.collection('users').doc(user?.uid);
        batch.update(userRef, {
          'xp': FieldValue.increment(widget.meta['xpReward'] ?? 0),
        });

        // Add to XP History
        final historyRef = userRef.collection('xp_history').doc();
        batch.set(historyRef, {
          'amount': widget.meta['xpReward'],
          'type': 'reading_plan',
          'taskTitle': 'Plano Concluído: ${widget.meta['title']}',
          'timestamp': FieldValue.serverTimestamp(),
        });
        
        // Notification
        final notifRef = FirebaseFirestore.instance.collection('notifications').doc();
        batch.set(notifRef, {
          'userId': user?.uid,
          'title': 'Plano de Leitura Concluído! 📖',
          'message': 'Você finalizou "${widget.meta['title']}" e ganhou ${widget.meta['xpReward']} XP!',
          'type': 'success',
          'createdAt': FieldValue.serverTimestamp(),
          'read': false,
        });
      }

      await batch.commit();
      
      setState(() {
        _completedChapters = newCompleted;
      });

      if (newCompleted.length == widget.meta['chapters']) {
        _showCompletionDialog();
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Erro ao salvar progresso.')),
      );
    }
  }

  void _showCompletionDialog() {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        title: const Text('Parabéns! 🎉', textAlign: TextAlign.center),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.workspace_premium_rounded, color: AppColors.warning, size: 80),
            const SizedBox(height: 16),
            Text(
              'Você completou o plano\n"${widget.meta['title']}"',
              textAlign: TextAlign.center,
              style: const TextStyle(fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Text('Ganhou +${widget.meta['xpReward']} XP!', style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold)),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.of(context).pop(); // dialog
              Navigator.of(context).pop(); // detail page
            },
            child: const Text('FECHAR'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    final totalChapters = widget.meta['chapters'] as int;
    final progress = _completedChapters.length / totalChapters;

    return WillPopScope(
      onWillPop: () async {
        if (_isReading) {
          final confirm = await showDialog<bool>(
            context: context,
            builder: (context) => AlertDialog(
              title: const Text('Cancelar leitura?'),
              content: const Text('Se sair agora, o tempo de foco será perdido.'),
              actions: [
                TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('CONTINUAR LENDO')),
                TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('SAIR', style: TextStyle(color: Colors.red))),
              ],
            ),
          );
          return confirm ?? false;
        }
        return true;
      },
      child: Scaffold(
        backgroundColor: Colors.grey[50],
        body: Column(
          children: [
            _buildHeader(progress, totalChapters),
            Expanded(
              child: _isReading ? _buildFocusView() : _buildChaptersList(totalChapters),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader(double progress, int totalChapters) {
    return Container(
      padding: const EdgeInsets.fromLTRB(24, 60, 24, 32),
      decoration: const BoxDecoration(
        color: AppColors.primary,
        borderRadius: BorderRadius.only(bottomLeft: Radius.circular(32), bottomRight: Radius.circular(32)),
        gradient: LinearGradient(
          colors: [AppColors.primary, Color(0xFF1E40AF)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          IconButton(
            onPressed: () => Navigator.pop(context),
            icon: const Icon(Icons.arrow_back, color: Colors.white),
          ),
          const SizedBox(height: 16),
          Text(
            widget.meta['title'],
            style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(10),
                  child: LinearProgressIndicator(
                    value: progress,
                    backgroundColor: Colors.white24,
                    valueColor: const AlwaysStoppedAnimation(Colors.white),
                    minHeight: 8,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Text(
                '${(progress * 100).toInt()}%',
                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              const Icon(Icons.menu_book_rounded, color: Colors.white70, size: 16),
              const SizedBox(width: 8),
              Text(
                '${_completedChapters.length} de $totalChapters capítulos',
                style: const TextStyle(color: Colors.white70),
              ),
              const Spacer(),
              const Icon(Icons.bolt, color: AppColors.warning, size: 16),
              const SizedBox(width: 4),
              Text(
                '+${widget.meta['xpReward']} XP',
                style: const TextStyle(color: AppColors.warning, fontWeight: FontWeight.bold),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildFocusView() {
    final targetSeconds = (secondsPerChapter * 0.9).toInt();
    final canComplete = _secondsElapsed >= targetSeconds;

    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Text(
            'MODO FOCO ATIVO',
            style: TextStyle(fontWeight: FontWeight.bold, letterSpacing: 2, color: AppColors.textSecondary),
          ),
          const SizedBox(height: 32),
          Stack(
            alignment: Alignment.center,
            children: [
              SizedBox(
                width: 200,
                height: 200,
                child: CircularProgressIndicator(
                  value: _secondsElapsed / targetSeconds > 1 ? 1 : _secondsElapsed / targetSeconds,
                  strokeWidth: 10,
                  backgroundColor: Colors.grey[200],
                  valueColor: AlwaysStoppedAnimation(canComplete ? AppColors.success : AppColors.primary),
                ),
              ),
              Column(
                children: [
                  Text(
                    '${(_secondsElapsed ~/ 60).toString().padLeft(2, '0')}:${(_secondsElapsed % 60).toString().padLeft(2, '0')}',
                    style: const TextStyle(fontSize: 48, fontWeight: FontWeight.bold, color: AppColors.primary),
                  ),
                  Text(
                    'Capítulo $_currentChapter',
                    style: const TextStyle(fontWeight: FontWeight.bold, color: AppColors.textSecondary),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 48),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 48),
            child: Text(
              canComplete 
                  ? 'Você já pode concluir este capítulo!' 
                  : 'Mantenha o aplicativo aberto para validar sua leitura.',
              textAlign: TextAlign.center,
              style: TextStyle(color: canComplete ? AppColors.success : Colors.grey[600], fontWeight: canComplete ? FontWeight.bold : FontWeight.normal),
            ),
          ),
          const SizedBox(height: 32),
          if (canComplete)
            ElevatedButton(
              onPressed: _completeChapter,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.success,
                padding: const EdgeInsets.symmetric(horizontal: 48, vertical: 16),
              ),
              child: const Text('CONCLUIR CAPÍTULO'),
            )
          else
            TextButton(
              onPressed: () => _stopReading(reset: true),
              child: const Text('CANCELAR LEITURA', style: TextStyle(color: Colors.red)),
            ),
        ],
      ),
    );
  }

  Widget _buildChaptersList(int total) {
    return ListView.builder(
      padding: const EdgeInsets.all(24),
      itemCount: total,
      itemBuilder: (context, index) {
        final chapterNum = index + 1;
        final isCompleted = _completedChapters.contains(chapterNum);

        return Container(
          margin: const EdgeInsets.only(bottom: 12),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            boxShadow: [
              BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 10, offset: const Offset(0, 4)),
            ],
          ),
          child: ListTile(
            contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
            title: Text('Capítulo $chapterNum', style: const TextStyle(fontWeight: FontWeight.bold)),
            subtitle: Text(isCompleted ? 'Leitura concluída' : 'Tempo estimado: 2 min'),
            trailing: isCompleted
                ? const Icon(Icons.check_circle_rounded, color: AppColors.success)
                : const Icon(Icons.play_circle_fill_rounded, color: AppColors.primary, size: 32),
            onTap: isCompleted ? null : () => _startReading(chapterNum),
          ),
        );
      },
    );
  }
}
