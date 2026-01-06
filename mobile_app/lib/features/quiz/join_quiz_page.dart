import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_database/firebase_database.dart';
import '../../../core/theme/app_colors.dart';
import 'quiz_arena_page.dart';

class JoinQuizPage extends StatefulWidget {
  const JoinQuizPage({super.key});

  @override
  State<JoinQuizPage> createState() => _JoinQuizPageState();
}

class _JoinQuizPageState extends State<JoinQuizPage> {
  bool _isLoading = true;
  String? _error;

  // Quiz Data
  Map<String, dynamic>? _quizData;
  bool _isBaseSpecific = false;
  
  final TextEditingController _pinController = TextEditingController();
  bool _pinEntered = false;

  // Selection Data
  List<Map<String, dynamic>> _bases = [];
  String? _selectedBaseId;
  
  List<Map<String, dynamic>> _users = [];
  Map<String, dynamic>? _selectedUser;

  @override
  void initState() {
    super.initState();
    // Check for arguments (deep link or nav args)
    // For now, let's assume direct nav.
    // Ideally we parse URI.
  }
  
  @override
  void dispose() {
    _pinController.dispose();
    super.dispose();
  }

  Future<void> _fetchActiveQuiz(String pin) async {
    setState(() {
       _isLoading = true;
       _error = null;
    });
    
    try {
      // 1. Get Active Quiz from Realtime DB using PIN
      final snapshot = await FirebaseDatabase.instance.ref('active_quizzes/$pin').get();
      
      if (!snapshot.exists || snapshot.value == null) {
        setState(() {
          _error = 'PIN inválido ou quiz não encontrado.';
          _isLoading = false;
        });
        return;
      }

      final data = Map<String, dynamic>.from(snapshot.value as Map);
      
      // Check if it has baseId (Base Specific)
      // Note: The 'MasterQuiz' saved in Firestore has baseId. 
      // The RealtimeDB node might just have 'quizId'.
      // We should check the Firestore structure of the ACTIVE quiz or trust the RTDB.
      // Assuming RTDB has the relevant config copy.
      // If not, we fetch from Firestore `master_quizzes`.
      
      String? baseId = data['baseId'];
      
      // If not in RTDB, fetch from Firestore `master_quizzes` using `originalQuizId` if present
      // But let's assume RTDB has it for now as per our 'startQuiz' logic.

      setState(() {
        _quizData = data;
        _isBaseSpecific = baseId != null && baseId.isNotEmpty;
        _selectedBaseId = baseId; // Pre-select if specific
        _pinEntered = true; // Proceed to selection
      });

      if (_isBaseSpecific) {
        await _fetchUsers(baseId!);
      } else {
        await _fetchBases();
      }

    } catch (e) {
      setState(() {
        _error = 'Erro ao carregar quiz: $e';
      });
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _fetchBases() async {
    try {
      final snapshot = await FirebaseFirestore.instance.collection('bases').get();
      final bases = snapshot.docs.map((doc) => {
        'id': doc.id,
        'name': doc.data()['name'],
      }).toList();
      
      // Sort alphabetically
      bases.sort((a, b) => (a['name'] as String).compareTo(b['name'] as String));

      setState(() {
        _bases = bases;
      });
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Erro ao carregar bases: $e')));
    }
  }

  Future<void> _fetchUsers(String baseId) async {
    setState(() => _isLoading = true);
    try {
      // Fetch Students from the Base
      final snapshot = await FirebaseFirestore.instance
          .collection('users')
          .where('baseId', isEqualTo: baseId)
          // We could filter by role 'student' or 'membro' if consistent
          //.where('role', isEqualTo: 'membro') 
          .get();

      final users = snapshot.docs.map((doc) {
        final data = doc.data();
        return {
          'id': doc.id,
          'name': data['name'] ?? data['displayName'] ?? 'Sem Nome',
          'email': data['email'],
          'classification': data['classification'] ?? 'pre-adolescente',
        };
      }).toList();

      // Sort alphabetically
      users.sort((a, b) => (a['name'] as String).compareTo(b['name'] as String));

      setState(() {
        _users = users;
        _selectedUser = null; // Reset selection
      });
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Erro ao carregar alunos: $e')));
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _handleJoin() async {
    if (_selectedUser == null) return;

    setState(() => _isLoading = true);

    try {
      // 1. Sign In (Anonymous or Custom Token if we had one, but effectively we want to 'impersonate' or just identify)
      // Since we don't have the user's password, we cannot sign in AS them fully in Firebase Auth.
      // BUT for the Quiz Arena, we just need their UID stored in RTDB answers.
      
      // If we use signInAnonymously(), the UID will be random. 
      // If we want to record XP for the REAL user, we need their Real UID.
      
      // The `quiz_arena_page.dart` uses `FirebaseAuth.instance.currentUser?.uid`.
      // If we are anonymous, that UID is random.
      // So answers will be saved under RandomUID.
      // And XP assignment logic (Cloud Function or client-side) will attribute to RandomUID.
      // FAILURE.
      
      // SOLUTION: We need to sign in? OR we pass the Real UID to the Arena Page and modify Arena to use THAT instead of Auth UID.
      // OR, this feature is only for "Quick Play" without XP? 
      // No, user wants to select THEIR name.
      
      // If we want XP, we probably need to handle this securely.
      // Ideally, the user should LOGIN with password.
      // But the requirement implies a quick selection (maybe for kids without phones?).
      
      // If we assume this is a "Kiosk Mode" or "Shared Device" where they just pick their name:
      // We can pass the `userId` to the Arena Page.
      // Modify `QuizArenaPage` to accept `overrideUserId` and `overrideUserName`.
      
      // Let's do that. It's the most pragmatic solution for "Select Name" flow without passwords.
      
      // If user is ALREADY logged in (e.g. on their own phone), we might want to respect that?
      // But the prompt says "User will select their name". This implies identifying themselves manually.
      
      await Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (_) => QuizArenaPage(
            guestUserId: _selectedUser!['id'],
            guestUserName: _selectedUser!['name'],
            quizPin: _pinController.text,
          ),
        ),
      );

    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Erro ao entrar: $e')));
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading && _pinEntered) {
        // Only show full screen loader if we are fetching AFTER pin entry
        return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    
    // Parse arguments/deep link roughly
    // In Flutter Web or standard deep linking, we'd use onGenerateRoute or extract from settings.
    // Here we'll just show the PIN entry if _pinEntered is false.

    return Scaffold(
      backgroundColor: AppColors.primary,
      body: SafeArea(
        child: Column(
          children: [
             Padding(
              padding: const EdgeInsets.all(24.0),
              child: Column(
                children: [
                  const Icon(Icons.quiz_rounded, size: 64, color: Colors.white),
                  const SizedBox(height: 16),
                  Text(
                    _quizData?['quizTitle'] ?? 'Play Quiz',
                    style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    _pinEntered ? 'Identifique-se para jogar' : 'Digite o PIN do jogo',
                    style: const TextStyle(color: Colors.white70),
                  ),
                ],
              ),
            ),
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
                child: !_pinEntered ? _buildPinEntry() : _buildSelectionForm(),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPinEntry() {
      return Column(
          children: [
               TextField(
                controller: _pinController,
                keyboardType: TextInputType.number,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 32, fontWeight: FontWeight.bold, letterSpacing: 8),
                decoration: InputDecoration(
                  hintText: '000000',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(16)),
                  errorText: _error
                ),
               ),
               const SizedBox(height: 24),
               SizedBox(
                   width: double.infinity,
                   child: ElevatedButton(
                    onPressed: () {
                        if (_pinController.text.length >= 6) {
                            _fetchActiveQuiz(_pinController.text);
                        }
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    ),
                    child: _isLoading 
                        ? const CircularProgressIndicator(color: Colors.white) 
                        : const Text('ENTRAR', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
                  ),
               )
          ],
      );
  }

  Widget _buildSelectionForm() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
                    if (!_isBaseSpecific) ...[
                      const Text('Selecione sua Base', style: TextStyle(fontWeight: FontWeight.bold)),
                      const SizedBox(height: 8),
                      // Dropdown for Base
                       DropdownButtonFormField<String>(
                        value: _selectedBaseId,
                        isExpanded: true,
                        decoration: InputDecoration(
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                        ),
                        hint: const Text('Escolha sua base...'),
                        items: _bases.map((base) {
                          return DropdownMenuItem(
                            value: base['id'] as String,
                            child: Text(base['name']),
                          );
                        }).toList(),
                        onChanged: (val) {
                          if (val != null) {
                            setState(() => _selectedBaseId = val);
                            _fetchUsers(val);
                          }
                        },
                      ),
                      const SizedBox(height: 24),
                    ],

                    if (_selectedBaseId != null) ...[
                      const Text('Selecione seu Nome', style: TextStyle(fontWeight: FontWeight.bold)),
                      const SizedBox(height: 8),
                      // Searchable List or simple Dropdown? Dropdown is easier for now.
                      // If many users, AutComplete/Search is better.
                      // Let's use Autocomplete for better UX if possible, or just a big Dropdown.
                      // Dropdown is safest/simplest for V1.
                      DropdownButtonFormField<String>(
                        value: _selectedUser?['id'],
                        isExpanded: true,
                        menuMaxHeight: 400, // Important for scrolling
                        decoration: InputDecoration(
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                        ),
                        hint: const Text('Quem é você?'),
                        items: _users.map((user) {
                          return DropdownMenuItem(
                            value: user['id'] as String,
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(user['name']),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: (user['classification'] == 'adolescente' ? Colors.indigo : Colors.teal).withOpacity(0.1),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: Text(
                                    user['classification'] == 'adolescente' ? 'TEEN' : 'PRE',
                                    style: TextStyle(
                                      fontSize: 10,
                                      fontWeight: FontWeight.bold,
                                      color: user['classification'] == 'adolescente' ? Colors.indigo : Colors.teal,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          );
                        }).toList(),
                        onChanged: (val) {
                           final user = _users.firstWhere((u) => u['id'] == val);
                           setState(() => _selectedUser = user);
                        },
                      ),
                    ],

                    const Spacer(),
                    
                    if (_selectedUser != null)
                      ElevatedButton(
                        onPressed: _handleJoin,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.primary,
                          padding: const EdgeInsets.symmetric(vertical: 16),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                        ),
                        child: const Text('ENTRAR NA ÁREA', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
                      ),
                    const SizedBox(height: 16),
                  ],
                ),
  }
