import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../../../core/theme/app_colors.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _isLoading = false;
  bool _obscurePassword = true;

  Future<void> _login() async {
    if (_emailController.text.isEmpty || _passwordController.text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Preencha todos os campos')),
      );
      return;
    }

    setState(() => _isLoading = true);

    try {
      final credential = await FirebaseAuth.instance.signInWithEmailAndPassword(
        email: _emailController.text.trim(),
        password: _passwordController.text,
      );

      // Streak Logic
      await _updateStreak(credential.user!.uid);

      if (mounted) {
        Navigator.pushReplacementNamed(context, '/dashboard');
      }
    } on FirebaseAuthException catch (e) {
      String message = 'Erro ao realizar login';
      if (e.code == 'user-not-found') message = 'Usuário não encontrado';
      if (e.code == 'wrong-password') message = 'Senha incorreta';
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(message), backgroundColor: AppColors.error),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Erro inesperado'), backgroundColor: AppColors.error),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _updateStreak(String uid) async {
    final userRef = FirebaseFirestore.instance.collection('users').doc(uid);
    
    try {
      await FirebaseFirestore.instance.runTransaction((transaction) async {
        final doc = await transaction.get(userRef);
        if (!doc.exists) return;

        final data = doc.data()!;
        final currentStreak = data['streak'] as int? ?? 0;
        final lastLoginTs = data['streakLastLogin'] as Timestamp?;
        
        final now = DateTime.now();
        final today = DateTime(now.year, now.month, now.day);
        
        int newStreak = 1;
        int xpBonus = 0;
        
        if (lastLoginTs != null) {
          final lastLoginDate = lastLoginTs.toDate();
          final lastLoginDay = DateTime(lastLoginDate.year, lastLoginDate.month, lastLoginDate.day);
          
          final difference = today.difference(lastLoginDay).inDays;
          
          if (difference == 0) {
            // Already logged in today
            newStreak = currentStreak;
          } else if (difference == 1) {
            // Consecutive login
            newStreak = currentStreak + 1;
            
            // Check Bonuses
            if (newStreak == 3) xpBonus = 50;
            if (newStreak == 7) xpBonus = 100;
          } else {
            // Streak broken
            newStreak = 1;
          }
        }

        // Prepare updates
        final updates = <String, dynamic>{
          'streak': newStreak,
          'streakLastLogin': FieldValue.serverTimestamp(),
        };

        if (xpBonus > 0) {
          updates['xp'] = FieldValue.increment(xpBonus);
          
          // Create History Record (Needs to be outside transaction or carefully handled)
          // For simplicity in this transaction, we just update user. 
          // Ideally we'd add to xp_history here too but transaction limits apply.
        }

        transaction.update(userRef, updates);
        
        // If bonus, we can't create doc in 'xp_history' easily inside the same transaction 
        // if we didn't read it, but we can do a set on a new doc ref.
        if (xpBonus > 0) {
           final historyRef = userRef.collection('xp_history').doc();
           transaction.set(historyRef, {
             'amount': xpBonus,
             'type': 'streak_bonus',
             'taskTitle': 'Ofensiva de $newStreak dias!',
             'timestamp': FieldValue.serverTimestamp(),
           });
           
           final notifRef = FirebaseFirestore.instance.collection('notifications').doc();
           transaction.set(notifRef, {
             'userId': uid,
             'title': 'Bônus de Ofensiva! 🔥',
             'message': 'Você manteve o foco por $newStreak dias e ganhou $xpBonus XP!',
             'type': 'success',
             'createdAt': FieldValue.serverTimestamp(),
             'read': false,
           });
        }
      });
    } catch (e) {
      print('Error updating streak: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 60),
              // Logo/Icon
              Center(
                child: Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withOpacity(0.1),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.emoji_events_rounded,
                    size: 80,
                    color: AppColors.primary,
                  ),
                ),
              ),
              const SizedBox(height: 32),
              Text(
                'Bem-vindo ao\nBaseteen',
                style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                      color: AppColors.textPrimary,
                    ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              Text(
                'Faça login para continuar sua jornada',
                style: Theme.of(context).textTheme.bodyMedium,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 48),

              // Form
              TextField(
                controller: _emailController,
                keyboardType: TextInputType.emailAddress,
                decoration: InputDecoration(
                  labelText: 'E-mail',
                  prefixIcon: const Icon(Icons.mail_outline),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                ),
              ),
              const SizedBox(height: 20),
              TextField(
                controller: _passwordController,
                obscureText: _obscurePassword,
                decoration: InputDecoration(
                  labelText: 'Senha',
                  prefixIcon: const Icon(Icons.lock_outline),
                  suffixIcon: IconButton(
                    icon: Icon(
                      _obscurePassword ? Icons.visibility_off : Icons.visibility,
                    ),
                    onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                  ),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Align(
                alignment: Alignment.centerRight,
                child: TextButton(
                  onPressed: () {},
                  child: const Text('Esqueceu a senha?'),
                ),
              ),
              const SizedBox(height: 32),

              ElevatedButton(
                onPressed: _isLoading ? null : _login,
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
                        'ENTRAR',
                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                      ),
              ),
              const SizedBox(height: 24),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Text('Não tem uma conta?'),
                  TextButton(
                    onPressed: () {},
                    child: const Text('Fale com seu líder'),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
