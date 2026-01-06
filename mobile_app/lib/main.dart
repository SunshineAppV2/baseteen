import 'package:flutter/material.dart';
import 'core/theme/app_theme.dart';
import 'features/auth/presentation/login_page.dart';
import 'features/dashboard/dashboard_page.dart';
import 'features/quiz/join_quiz_page.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  // Firebase.initializeApp() will go here
  runApp(const TeensApp());
}

class TeensApp extends StatelessWidget {
  const TeensApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Baseteen',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      home: const InitialPage(),
      routes: {
        '/login': (context) => const LoginPage(),
        '/dashboard': (context) => const DashboardPage(),
        '/play': (context) => const JoinQuizPage(),
      },
    );
  }
}

class InitialPage extends StatelessWidget {
  const InitialPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: Colors.blue.withOpacity(0.1),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.emoji_events_rounded,
                size: 80,
                color: Color(0xFF2A8AC9),
              ),
            ),
            const SizedBox(height: 32),
            Text(
              'Baseteen',
              style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                    color: const Color(0xFF212529),
                    fontWeight: FontWeight.bold,
                  ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              'Ministério do Adolescente',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const SizedBox(height: 48),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 40),
              child: ElevatedButton(
                onPressed: () {
                  Navigator.pushNamed(context, '/login');
                },
                child: const Text('Entrar no App'),
              ),
            ),
            TextButton(
              onPressed: () {
                 Navigator.pushNamed(context, '/dashboard');
              },
              child: const Text('Entrar como Convidado (Demo)'),
            ),
          ],
        ),
      ),
    );
  }
}

