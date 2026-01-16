import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../quiz/quiz_arena_page.dart';
import '../tasks/task_detail_page.dart';
import '../ranking/ranking_page.dart';
import '../profile/profile_page.dart';
import '../notifications/notifications_page.dart';
import '../reading/reading_detail_page.dart';
import '../quiz/quiz_area_page.dart';

class DashboardPage extends StatefulWidget {
  const DashboardPage({super.key});

  @override
  State<DashboardPage> createState() => _DashboardPageState();
}

class _DashboardPageState extends State<DashboardPage> {
  int _currentIndex = 0;

  @override
  Widget build(BuildContext context) {
    final user = FirebaseAuth.instance.currentUser;

    if (_currentIndex == 1) return const QuizAreaPage();
    if (_currentIndex == 2) return const RankingPage();
    if (_currentIndex == 3) return const ProfilePage();

    return StreamBuilder<DocumentSnapshot>(
      stream: FirebaseFirestore.instance.collection('users').doc(user?.uid).snapshots(),
      builder: (context, snapshot) {
        if (!snapshot.hasData) {
          return const Scaffold(body: Center(child: CircularProgressIndicator()));
        }

        final userData = snapshot.data!.data() as Map<String, dynamic>?;
        final int totalXp = userData?['xp'] ?? 0;
        final int streak = userData?['streak'] ?? 0;
        final String displayName = userData?['displayName'] ?? 'Aventureiro';
        final String baseId = userData?['baseId'] ?? 'Sem Base';
        final String districtId = userData?['districtId'] ?? 'Sem Distrito';

        final String? avatarUrl = userData?['photoURL'];

        // Level Logic: 500 XP per level
        final int level = (totalXp / 500).floor() + 1;
        final int xpInCurrentLevel = totalXp % 500;
        final double progress = xpInCurrentLevel / 500.0;

        return Scaffold(
          body: CustomScrollView(
            slivers: [
              // Premium Header
              SliverAppBar(
                expandedHeight: 200,
                floating: false,
                pinned: true,
                backgroundColor: AppColors.primary,
                actions: [
                  StreamBuilder<QuerySnapshot>(
                    stream: FirebaseFirestore.instance
                        .collection('notifications')
                        .where('userId', isEqualTo: user?.uid)
                        .where('read', isEqualTo: false)
                        .snapshots(),
                    builder: (context, snapshot) {
                      final unreadCount = snapshot.data?.docs.length ?? 0;
                      return Stack(
                        alignment: Alignment.center,
                        children: [
                          IconButton(
                            onPressed: () {
                              Navigator.push(
                                context,
                                MaterialPageRoute(builder: (context) => const NotificationsPage()),
                              );
                            },
                            icon: const Icon(Icons.notifications_rounded, color: Colors.white),
                          ),
                          if (unreadCount > 0)
                            Positioned(
                              right: 8,
                              top: 8,
                              child: Container(
                                padding: const EdgeInsets.all(4),
                                decoration: const BoxDecoration(
                                  color: Colors.red,
                                  shape: BoxShape.circle,
                                ),
                                child: Text(
                                  unreadCount.toString(),
                                  style: const TextStyle(color: Colors.white, fontSize: 8, fontWeight: FontWeight.bold),
                                ),
                              ),
                            ),
                        ],
                      );
                    },
                  ),
                ],
                flexibleSpace: FlexibleSpaceBar(
                  background: Container(
                    decoration: const BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: [AppColors.primary, Color(0xFF1B6A9C)],
                      ),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(24, 80, 24, 24),
                      child: Row(
                        children: [
                          // Avatar with Level Badge
                          Stack(
                            alignment: Alignment.bottomRight,
                            children: [
                              Container(
                                width: 70,
                                height: 70,
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  shape: BoxShape.circle,
                                  border: Border.all(color: Colors.white.withOpacity(0.5), width: 2),
                                ),
                                child: ClipOval(
                                  child: avatarUrl != null
                                      ? Image.network(avatarUrl, fit: BoxFit.cover)
                                      : Center(
                                          child: Text(
                                            (displayName.isNotEmpty ? displayName[0] : 'U').toUpperCase(),
                                            style: const TextStyle(
                                              color: AppColors.primary,
                                              fontSize: 28,
                                              fontWeight: FontWeight.bold,
                                            ),
                                          ),
                                        ),
                                ),
                              ),
                              Container(
                                padding: const EdgeInsets.all(4),
                                decoration: const BoxDecoration(
                                  color: AppColors.warning,
                                  shape: BoxShape.circle,
                                ),
                                child: Text(
                                  level.toString(),
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 10,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(width: 16),
                          Expanded(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Olá, $displayName!',
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 20,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  '$baseId • $districtId',
                                  style: const TextStyle(
                                    color: Colors.white70,
                                    fontSize: 13,
                                  ),
                                ),
                                const SizedBox(height: 12),
                                // XP Bar
                                ClipRRect(
                                  borderRadius: BorderRadius.circular(4),
                                  child: LinearProgressIndicator(
                                    value: progress,
                                    backgroundColor: Colors.white.withOpacity(0.2),
                                    valueColor: const AlwaysStoppedAnimation(Colors.white),
                                    minHeight: 6,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  '$xpInCurrentLevel / 500 XP para o Nível ${level + 1}',
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 11,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),

              // Content
              SliverPadding(
                padding: const EdgeInsets.all(24),
                sliver: SliverList(
                  delegate: SliverChildListDelegate([
                    const SizedBox(height: 16),
                    const Text(
                      'Plano de Leitura',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 16),
                    StreamBuilder<DocumentSnapshot>(
                      stream: FirebaseFirestore.instance.collection('settings').doc('reading').snapshots(),
                      builder: (context, snapshot) {
                        if (!snapshot.hasData || !snapshot.data!.exists) return const SizedBox();
                        final data = snapshot.data!.data() as Map<String, dynamic>;
                        final metas = (data['metas'] as List? ?? []);
                        
                        return SizedBox(
                          height: 120,
                          child: ListView.builder(
                            scrollDirection: Axis.horizontal,
                            itemCount: metas.length,
                            itemBuilder: (context, index) {
                              final meta = metas[index] as Map<String, dynamic>;
                              return GestureDetector(
                                onTap: () {
                                  Navigator.push(
                                    context,
                                    MaterialPageRoute(
                                      builder: (context) => ReadingDetailPage(meta: meta),
                                    ),
                                  );
                                },
                                child: Container(
                                  width: 160,
                                  margin: const EdgeInsets.only(right: 16),
                                  padding: const EdgeInsets.all(16),
                                  decoration: BoxDecoration(
                                    gradient: const LinearGradient(
                                      colors: [AppColors.primary, Color(0xFF1E40AF)],
                                      begin: Alignment.topLeft,
                                      end: Alignment.bottomRight,
                                    ),
                                    borderRadius: BorderRadius.circular(20),
                                    boxShadow: [
                                      BoxShadow(
                                        color: AppColors.primary.withOpacity(0.3),
                                        blurRadius: 10,
                                        offset: const Offset(0, 4),
                                      ),
                                    ],
                                  ),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Text(
                                        meta['title'] ?? 'Lote',
                                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
                                        maxLines: 2,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                      Row(
                                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                        children: [
                                          Text(
                                            '${meta['chapters']} Caps',
                                            style: const TextStyle(color: Colors.white70, fontSize: 12),
                                          ),
                                          Container(
                                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                            decoration: BoxDecoration(
                                              color: Colors.white24,
                                              borderRadius: BorderRadius.circular(6),
                                            ),
                                            child: Text(
                                              '+${meta['xpReward']} XP',
                                              style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ],
                                  ),
                                ),
                              );
                            },
                          ),
                        );
                      },
                    ),

                    const SizedBox(height: 32),
                    const Text(
                      'Próximos Requisitos',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 16),
                    
                    // Task Collection Stream
                    StreamBuilder<QuerySnapshot>(
                      stream: FirebaseFirestore.instance
                          .collection('tasks')
                          .where(Filter.or(
                            Filter('visibilityScope', isEqualTo: 'all'),
                            Filter('visibilityScope', isEqualTo: 'base'),
                            Filter('visibilityScope', isEqualTo: 'district'),
                          ))
                          .limit(100)
                          .snapshots(),
                      builder: (context, taskSnapshot) {
                        if (taskSnapshot.hasError) {
                          debugPrint('Erro na busca de tasks: ${taskSnapshot.error}');
                          return const SizedBox();
                        }
                        if (!taskSnapshot.hasData) return const SizedBox();
                        
                        final String baseId = userData?['baseId'] ?? '';
                        final String districtId = userData?['districtId'] ?? '';
                        final String regionId = userData?['regionId'] ?? '';
                        final String associationId = userData?['associationId'] ?? '';
                        final String unionId = userData?['unionId'] ?? '';

                        final allTasks = taskSnapshot.data!.docs;
                        
                        // Client-side filtering: Fix 'Mixing' and 'Target Base Type'
                        final tasks = allTasks.where((doc) {
                          final data = doc.data() as Map<String, dynamic>;
                          final scope = data['visibilityScope'] ?? 'all';
                          
                          // 1. Visibility Check: Only show what matches the user's specific hierarchy OR global
                          bool isVisible = false;
                          if (scope == 'all') {
                            isVisible = true;
                          } else if (scope == 'union') {
                            isVisible = unionId.isNotEmpty && data['unionId'] == unionId;
                          } else if (scope == 'association') {
                            isVisible = associationId.isNotEmpty && data['associationId'] == associationId;
                          } else if (scope == 'region') {
                            isVisible = regionId.isNotEmpty && data['regionId'] == regionId;
                          } else if (scope == 'district') {
                            isVisible = districtId.isNotEmpty && data['districtId'] == districtId;
                          } else if (scope == 'base') {
                            isVisible = baseId.isNotEmpty && data['baseId'] == baseId;
                          }
                          
                          if (!isVisible) return false;

                          // 2. Hide duplicates (if a base-specific version of this task exists, hide the wider version)
                          if (scope != 'base') {
                            final hasBaseVersion = allTasks.any((doc) {
                              final d = doc.data() as Map<String, dynamic>;
                              return (d['visibilityScope'] == 'base' || d['isCustomized'] == true) && 
                                     d['title'] == data['title'];
                            });
                            if (hasBaseVersion) return false;
                          }

                          // 3. Base Type Filtering (Soul+/Teen)
                          final target = data['targetBaseType'] ?? 'both';
                          final userBaseType = userData?['baseType'] ?? 'teen';
                          
                          if (target != 'both' && target != userBaseType) return false;

                          // 3. Collective Check: Members don't see collective base tasks
                          if (data['isBaseCollective'] == true && userData?['role'] == 'membro') return false;
                          
                          return true;
                        }).toList();

                        // 4. Client-side sorting (Since we removed it from Firestore to avoid index issues)
                        tasks.sort((a, b) {
                          final dataA = a.data() as Map<String, dynamic>;
                          final dataB = b.data() as Map<String, dynamic>;
                          
                          final dateAStr = dataA['createdAt']?.toString() ?? '';
                          final dateBStr = dataB['createdAt']?.toString() ?? '';
                          
                          if (dateAStr.isEmpty) return 1;
                          if (dateBStr.isEmpty) return -1;
                          
                          // Descending order (newer first)
                          return dateBStr.compareTo(dateAStr);
                        });
                        
                        if (tasks.isEmpty) {
                          return const Center(
                            child: Padding(
                              padding: EdgeInsets.symmetric(vertical: 20),
                              child: Text(
                                'Nenhum requisito disponível para sua base.',
                                style: TextStyle(color: Colors.grey, fontSize: 13),
                              ),
                            ),
                          );
                        }

                        return Column(
                          children: tasks.map((doc) {
                            final task = doc.data() as Map<String, dynamic>;
                            return Padding(
                              padding: const EdgeInsets.only(bottom: 16),
                              child: _buildTaskCard(
                                context,
                                id: doc.id,
                                title: task['title'] ?? 'Sem Título',
                                description: task['description'] ?? '',
                                xp: task['points'] ?? task['xpReward'] ?? 0,
                                type: task['type'] ?? 'Texto',
                                isBaseSpecific: task['visibilityScope'] == 'base' || task['isCustomized'] == true,
                                isCollective: task['isBaseCollective'] == true,
                                baseId: baseId,
                                dueDate: task['deadline'] != null 
                                  ? 'Até ${DateTime.parse(task['deadline']).day.toString().padLeft(2, '0')}/${DateTime.parse(task['deadline']).month.toString().padLeft(2, '0')}'
                                  : 'Ativo',
                                icon: _getIconForType(task['type']),
                              ),
                            );
                          }).toList(),
                        );
                      },
                    ),

                    const SizedBox(height: 16),
                    const Text(
                      'Desempenho Geral',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        Expanded(child: _buildStatsCard('Total XP', '$totalXp', Icons.stars_rounded, Colors.orange)),
                        const SizedBox(width: 16),
                        Expanded(child: _buildStatsCard('Ofensiva', '$streak Dias', Icons.local_fire_department_rounded, Colors.red)),
                      ],
                    ),
                  ]),
                ),
              ),
            ],
          ),
          floatingActionButton: FloatingActionButton.extended(
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (context) => const QuizAreaPage()),
              );
            },
            backgroundColor: AppColors.primary,
            icon: const Icon(Icons.bolt_rounded, color: Colors.white),
            label: const Text(
              'ÁREA DO QUIZ',
              style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
            ),
          ),
          bottomNavigationBar: BottomNavigationBar(
            currentIndex: _currentIndex,
            selectedItemColor: AppColors.primary,
            unselectedItemColor: AppColors.textSecondary,
            onTap: (index) {
              setState(() {
                _currentIndex = index;
              });
            },
            items: const [
              BottomNavigationBarItem(icon: Icon(Icons.dashboard_rounded), label: 'Início'),
              BottomNavigationBarItem(icon: Icon(Icons.quiz_rounded), label: 'Quizzes'),
              BottomNavigationBarItem(icon: Icon(Icons.emoji_events_rounded), label: 'Ranking'),
              BottomNavigationBarItem(icon: Icon(Icons.person_rounded), label: 'Perfil'),
            ],
          ),
        );
      },
    );
  }

  IconData _getIconForType(String? type) {
    switch (type) {
      case 'file': return Icons.camera_alt_rounded;
      case 'quiz': return Icons.quiz_rounded;
      default: return Icons.auto_stories_rounded;
    }
  }

  Widget _buildStatsCard(String label, String value, IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: color.withOpacity(0.05),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: color.withOpacity(0.1)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: color.withOpacity(0.1),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Icon(icon, color: color, size: 28),
          ),
          const SizedBox(width: 16),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                value,
                style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: color),
              ),
              Text(
                label,
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.textSecondary),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildTaskCard(BuildContext context, {
    required String id,
    required String title,
    required String description,
    required int xp,
    required String type,
    required String dueDate,
    required IconData icon,
    bool isBaseSpecific = false,
    bool isCollective = false,
    String? baseId,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
        border: Border.all(color: Colors.grey.withOpacity(0.1)),
      ),
      child: InkWell(
        onTap: () {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (context) => TaskDetailPage(
                taskId: id,
                title: title,
                description: description,
                xp: xp,
                type: type,
                isBaseCollective: isCollective,
                baseId: baseId ?? '',
              ),
            ),
          );
        },
        borderRadius: BorderRadius.circular(20),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.primary.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Icon(icon, color: AppColors.primary, size: 28),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (isBaseSpecific || isCollective)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 6),
                        child: Row(
                          children: [
                            if (isBaseSpecific)
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFFF6B00), // Vibrant orange from image
                                  borderRadius: BorderRadius.circular(20), // Pill shape
                                  boxShadow: [
                                    BoxShadow(
                                      color: const Color(0xFFFF6B00).withOpacity(0.3),
                                      blurRadius: 4,
                                      offset: const Offset(0, 2),
                                    ),
                                  ],
                                ),
                                child: const Text(
                                  'REQUISITO BASE',
                                  style: TextStyle(
                                    color: Colors.white,
                                    fontSize: 9,
                                    fontWeight: FontWeight.black,
                                    letterSpacing: 0.5,
                                  ),
                                ),
                              ),
                            if (isBaseSpecific && isCollective) const SizedBox(width: 8),
                            if (isCollective)
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                decoration: BoxDecoration(
                                  color: AppColors.primary, 
                                  borderRadius: BorderRadius.circular(20),
                                  boxShadow: [
                                    BoxShadow(
                                      color: AppColors.primary.withOpacity(0.3),
                                      blurRadius: 4,
                                      offset: const Offset(0, 2),
                                    ),
                                  ],
                                ),
                                child: const Text(
                                  'COLETIVO',
                                  style: TextStyle(
                                    color: Colors.white,
                                    fontSize: 9,
                                    fontWeight: FontWeight.black,
                                    letterSpacing: 0.5,
                                  ),
                                ),
                              ),
                          ],
                        ),
                      ),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          title,
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                        ),
                        Text(
                          '+$xp XP',
                          style: const TextStyle(
                            color: AppColors.primary,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      description,
                      style: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Icon(Icons.access_time_rounded, size: 14, color: AppColors.warning),
                        const SizedBox(width: 4),
                        Text(
                          dueDate,
                          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.warning),
                        ),
                        const Spacer(),
                        const Text(
                          'VER DETALHES',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            color: AppColors.primary,
                            letterSpacing: 0.5,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildRankingItem(int rank, String name, String xp, bool isMe) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: isMe ? AppColors.primary.withOpacity(0.05) : Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isMe ? AppColors.primary.withOpacity(0.2) : Colors.grey.withOpacity(0.1),
        ),
      ),
      child: Row(
        children: [
          Text(
            rank.toString(),
            style: TextStyle(
              fontWeight: FontWeight.bold,
              color: isMe ? AppColors.primary : AppColors.textSecondary,
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Text(
              name,
              style: TextStyle(
                fontWeight: isMe ? FontWeight.bold : FontWeight.normal,
              ),
            ),
          ),
          Text(
            xp,
            style: const TextStyle(fontWeight: FontWeight.bold),
          ),
        ],
      ),
    );
  }
}
