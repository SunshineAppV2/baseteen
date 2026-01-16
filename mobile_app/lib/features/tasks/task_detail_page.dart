import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';

class TaskDetailPage extends StatefulWidget {
  final String taskId;
  final String title;
  final String description;
  final int xp;
  final String type;
  final bool isBaseCollective;
  final String? baseId;

  const TaskDetailPage({
    super.key,
    required this.taskId,
    required this.title,
    required this.description,
    required this.xp,
    required this.type,
    this.isBaseCollective = false,
    this.baseId,
  });

  @override
  State<TaskDetailPage> createState() => _TaskDetailPageState();
}

class _TaskDetailPageState extends State<TaskDetailPage> {
  final _contentController = TextEditingController();
  bool _isLoading = false;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Enviar Prova'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Task Summary
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: AppColors.primary.withOpacity(0.05),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: AppColors.primary.withOpacity(0.1)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        widget.type,
                        style: TextStyle(
                          color: AppColors.primary,
                          fontWeight: FontWeight.bold,
                          fontSize: 12,
                          letterSpacing: 1,
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: AppColors.primary,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          '+${widget.xp} XP',
                          style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                            fontSize: 12,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Text(
                    widget.title,
                    style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    widget.description,
                    style: const TextStyle(color: AppColors.textSecondary, height: 1.5),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 32),

            // Help Text
            const Text(
              'Sua Resposta',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 12),

            if (widget.type == 'Foto')
              _buildFileUploadArea()
            else if (widget.type == 'Texto')
              TextField(
                controller: _contentController,
                maxLines: 6,
                decoration: InputDecoration(
                  hintText: 'Escreva seu resumo ou resposta aqui...',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                ),
              )
            else
              TextField(
                controller: _contentController,
                decoration: InputDecoration(
                  hintText: 'Cole o link da postagem ou documento...',
                  prefixIcon: const Icon(Icons.link),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                ),
              ),

            const SizedBox(height: 48),

            ElevatedButton(
              onPressed: _isLoading ? null : _submitProof,
              style: ElevatedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 16),
              ),
              child: _isLoading
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : const Text(
                      'ENVIAR PARA APROVAÇÃO',
                      style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
                    ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _submitProof() async {
    if (_contentController.text.trim().isEmpty && widget.type != 'Foto') {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Por favor, preencha o conteúdo da prova.')),
      );
      return;
    }

    setState(() => _isLoading = true);

    try {
      final user = FirebaseAuth.instance.currentUser;
      
      final userDoc = await FirebaseFirestore.instance.collection('users').doc(user?.uid).get();
      final userData = userDoc.data() ?? {};
      
      final collectionName = widget.isBaseCollective ? 'base_submissions' : 'submissions';
      final submissionId = widget.isBaseCollective 
        ? '${widget.taskId}_${user?.uid}' // Simpler ID to avoid clashes
        : '${widget.taskId}_${user?.uid}';
      
      final data = {
        'taskId': widget.taskId,
        'taskTitle': widget.title,
        'userId': user?.uid,
        'userName': userData['displayName'] ?? user?.displayName ?? 'Membro',
        'status': 'pending',
        'xpReward': widget.xp,
        'baseId': userData['baseId'],
        'districtId': userData['districtId'],
        'regionId': userData['regionId'],
        'associationId': userData['associationId'],
        'unionId': userData['unionId'],
        'proof': {
          'content': _contentController.text.trim().isEmpty ? 'Imagem Enviada' : _contentController.text.trim(),
          'submittedAt': FieldValue.serverTimestamp(),
        },
        'updatedAt': FieldValue.serverTimestamp(),
      };

      if (widget.isBaseCollective) {
        data['baseName'] = userData['baseName'] ?? 'Minha Base';
        data['submittedBy'] = user?.uid;
        data['submittedByName'] = userData['displayName'] ?? user?.displayName;
      }

      await FirebaseFirestore.instance.collection(collectionName).doc(submissionId).set(data);

      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Prova enviada com sucesso! Aguarde a aprovação.'),
            backgroundColor: AppColors.success,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Erro ao enviar prova: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Widget _buildFileUploadArea() {
    return Container(
      height: 200,
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.grey.withOpacity(0.2), style: BorderStyle.solid),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.cloud_upload_outlined, size: 48, color: Colors.grey[400]),
          const SizedBox(height: 16),
          const Text(
            'Tocar para selecionar foto',
            style: TextStyle(fontWeight: FontWeight.bold, color: AppColors.textSecondary),
          ),
          const SizedBox(height: 4),
          Text(
            'Formatos: JPG, PNG até 5MB',
            style: TextStyle(fontSize: 12, color: Colors.grey[400]),
          ),
        ],
      ),
    );
  }
}
