import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../../../core/theme/app_colors.dart';
import 'quiz_arena_page.dart'; // We might want a different page for individual play if Arena is only for Live events
import 'join_quiz_page.dart';
import 'individual_quiz_page.dart';

class QuizAreaPage extends StatefulWidget {
  const QuizAreaPage({super.key});

  @override
  State<QuizAreaPage> createState() => _QuizAreaPageState();
}

class _QuizAreaPageState extends State<QuizAreaPage> {
  final _currentUser = FirebaseAuth.instance.currentUser;
  
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Área do Quiz', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.white,
        foregroundColor: AppColors.textPrimary,
        elevation: 0,
      ),
      body: StreamBuilder<DocumentSnapshot>(
        stream: FirebaseFirestore.instance.collection('users').doc(_currentUser?.uid).snapshots(),
        builder: (context, userSnapshot) {
          if (!userSnapshot.hasData) return const Center(child: CircularProgressIndicator());
          
          final userData = userSnapshot.data!.data() as Map<String, dynamic>?;
          final userClassification = userData?['classification'] ?? 'pre-adolescente';

          return Column(
            children: [
              // Live Quiz Banner / PIN Entry
              _buildLiveQuizCard(context),
              
              const Padding(
                padding: EdgeInsets.fromLTRB(24, 24, 24, 8),
                child: Row(
                  children: [
                    Icon(Icons.library_books_rounded, color: AppColors.primary, size: 20),
                    SizedBox(width: 8),
                    Text(
                      'Quizzes Disponíveis',
                      style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
              ),

              Expanded(
                child: StreamBuilder<QuerySnapshot>(
                  stream: FirebaseFirestore.instance
                      .collection('master_quizzes')
                      .where('availableToStudents', isEqualTo: true)
                      .snapshots(),
                  builder: (context, quizSnapshot) {
                    if (!quizSnapshot.hasData) return const Center(child: CircularProgressIndicator());

                    final quizzes = quizSnapshot.data!.docs.where((doc) {
                      final data = doc.data() as Map<String, dynamic>;
                      final quizClassification = data['classification'] ?? 'todos';
                      final quizBaseId = data['baseId'];
                      
                      final matchesClassification = quizClassification == 'todos' || quizClassification == userClassification;
                      final matchesBase = quizBaseId == null || quizBaseId == userData?['baseId'];

                      return matchesClassification && matchesBase;
                    }).toList();

                    if (quizzes.isEmpty) {
                      return const Center(
                        child: Text(
                          'Nenhum quiz disponível no momento.',
                          style: TextStyle(color: AppColors.textSecondary),
                        ),
                      );
                    }

                    return ListView.builder(
                      padding: const EdgeInsets.all(24),
                      itemCount: quizzes.length,
                      itemBuilder: (context, index) {
                        final quiz = quizzes[index].data() as Map<String, dynamic>;
                        return _buildQuizCard(context, quiz);
                      },
                    );
                  },
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _buildLiveQuizCard(BuildContext context) {
    return Container(
      margin: const EdgeInsets.all(24),
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [AppColors.primary, Color(0xFF1E40AF)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withOpacity(0.3),
            blurRadius: 15,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'AO VIVO AGORA?',
                style: TextStyle(color: Colors.white70, fontWeight: FontWeight.bold, fontSize: 12, letterSpacing: 1.2),
              ),
              Icon(Icons.live_tv_rounded, color: Colors.white, size: 20),
            ],
          ),
          const SizedBox(height: 12),
          const Text(
            'Entrar com PIN do Jogo',
            style: TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 8),
          const Text(
            'Seu professor iniciou um quiz na sala? Digite o código para participar!',
            style: TextStyle(color: Colors.white70, fontSize: 14),
          ),
          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (context) => const JoinQuizPage()),
                );
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.white,
                foregroundColor: AppColors.primary,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              ),
              child: const Text('DIGITAR PIN', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildQuizCard(BuildContext context, Map<String, dynamic> quiz) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.grey.withOpacity(0.1)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.03),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: ListTile(
        contentPadding: const EdgeInsets.all(16),
        leading: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: AppColors.primary.withOpacity(0.1),
            borderRadius: BorderRadius.circular(16),
          ),
          child: const Icon(Icons.quiz_rounded, color: AppColors.primary),
        ),
        title: Text(
          quiz['title'] ?? 'Sem Título',
          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
        ),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
             const SizedBox(height: 4),
             Text(
               quiz['description'] ?? '',
               maxLines: 2,
               overflow: TextOverflow.ellipsis,
               style: const TextStyle(fontSize: 13),
             ),
             const SizedBox(height: 8),
             Row(
               children: [
                 Container(
                   padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                   decoration: BoxDecoration(
                     color: Colors.orange.withOpacity(0.1),
                     borderRadius: BorderRadius.circular(8),
                   ),
                   child: Text(
                     '${(quiz['questions'] as List?)?.length ?? 0} Perguntas',
                     style: const TextStyle(color: Colors.orange, fontSize: 11, fontWeight: FontWeight.bold),
                   ),
                 ),
                 const SizedBox(width: 8),
                 Container(
                   padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                   decoration: BoxDecoration(
                     color: Colors.green.withOpacity(0.1),
                     borderRadius: BorderRadius.circular(8),
                   ),
                   child: const Text(
                     'Individual',
                     style: TextStyle(color: Colors.green, fontSize: 11, fontWeight: FontWeight.bold),
                   ),
                 ),
               ],
             ),
          ],
        ),
        onTap: () {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (context) => IndividualQuizPage(
                quiz: quiz,
                quizId: quizzes[index].id,
              ),
            ),
          );
        },
      ),
    );
  }
}
