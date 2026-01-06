import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../../core/theme/app_colors.dart';

class RankingPage extends StatefulWidget {
  const RankingPage({super.key});

  @override
  State<RankingPage> createState() => _RankingPageState();
}

class _RankingPageState extends State<RankingPage> {
  String _selectedDistrictId = 'global';
  String? _currentUserBaseId;
  String? _currentUserRole;

  @override
  void initState() {
    super.initState();
    _fetchCurrentUser();
  }

  Future<void> _fetchCurrentUser() async {
     final user = FirebaseAuth.instance.currentUser;
     if (user != null) {
       final doc = await FirebaseFirestore.instance.collection('users').doc(user.uid).get();
       if (doc.exists) {
         final data = doc.data() as Map<String, dynamic>;
         setState(() {
           _currentUserBaseId = data['baseId'];
           _currentUserRole = data['role'];
         });
       }
     }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.primary,
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(context),
            _buildDistrictFilter(),
            const SizedBox(height: 16),
            Expanded(
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.only(top: 24),
                decoration: const BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.only(
                    topLeft: Radius.circular(32),
                    topRight: Radius.circular(32),
                  ),
                ),
                child: StreamBuilder<QuerySnapshot>(
                  stream: _getQuery(),
                  builder: (context, snapshot) {
                    if (snapshot.hasError) {
                      return const Center(child: Text('Erro ao carregar ranking'));
                    }

                    if (snapshot.connectionState == ConnectionState.waiting) {
                      return const Center(child: CircularProgressIndicator());
                    }

                    final users = snapshot.data?.docs ?? [];

                    if (users.isEmpty) {
                      return const Center(child: Text('Nenhum dado de ranking disponível'));
                    }

                    return ListView.builder(
                      padding: const EdgeInsets.symmetric(horizontal: 24),
                      itemCount: users.length,
                      itemBuilder: (context, index) {
                        final userData = users[index].data() as Map<String, dynamic>;
                        return _buildRankingTile(index + 1, userData);
                      },
                    );
                  },
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Stream<QuerySnapshot> _getQuery() {
    Query query = FirebaseFirestore.instance.collection('users');
    
    // Strict isolation for members: Only see their base
    if (_currentUserRole == 'membro' && _currentUserBaseId != null) {
      query = query.where('baseId', isEqualTo: _currentUserBaseId);
    } 
    // Otherwise, standard filters
    else if (_selectedDistrictId != 'global') {
      query = query.where('districtId', isEqualTo: _selectedDistrictId);
    }
    
    return query.orderBy('xp', descending: true).limit(50).snapshots();
  }

  Widget _buildDistrictFilter() {
    return StreamBuilder<QuerySnapshot>(
      stream: FirebaseFirestore.instance.collection('districts').snapshots(),
      builder: (context, snapshot) {
        if (!snapshot.hasData) return const SizedBox();
        // If member, hide filters entirely as they are locked to base
        if (_currentUserRole == 'membro') return const SizedBox();

        final districts = snapshot.data!.docs;

        return SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Row(
            children: [
              _buildFilterChip('global', 'Global'),
              ...districts.map((d) {
                final data = d.data() as Map<String, dynamic>;
                return Padding(
                  padding: const EdgeInsets.only(left: 8),
                  child: _buildFilterChip(d.id, data['name'] ?? 'Distrito'),
                );
              }),
            ],
          ),
        );
      },
    );
  }

  Widget _buildFilterChip(String id, String label) {
    final isSelected = _selectedDistrictId == id;
    return ChoiceChip(
      label: Text(
        label,
        style: TextStyle(
          color: isSelected ? AppColors.primary : Colors.white70,
          fontWeight: FontWeight.bold,
          fontSize: 12,
        ),
      ),
      selected: isSelected,
      onSelected: (selected) {
        if (selected) {
          setState(() {
            _selectedDistrictId = id;
          });
        }
      },
      selectedColor: Colors.white,
      backgroundColor: Colors.white.withOpacity(0.1),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      side: BorderSide.none,
      showCheckmark: false,
    );
  }

  Widget _buildHeader(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 24, 24, 8),
      child: Column(
        children: [
          Row(
            children: [
              IconButton(
                onPressed: () => Navigator.pop(context),
                icon: const Icon(Icons.arrow_back, color: Colors.white),
              ),
              const Expanded(
                child: Text(
                  'TOP 50 RANKING',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 1.5,
                  ),
                ),
              ),
              const SizedBox(width: 48),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildRankingTile(int position, Map<String, dynamic> userData) {
    final bool isTop3 = position <= 3 && _selectedDistrictId == 'global';
    final Color? medalColor = (position == 1 && isTop3)
        ? Colors.orange 
        : ((position == 2 && isTop3) ? Colors.grey[400] : ((position == 3 && isTop3) ? Colors.brown[400] : null));

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isTop3 ? AppColors.primary.withOpacity(0.05) : Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: isTop3 ? AppColors.primary.withOpacity(0.1) : Colors.grey.withOpacity(0.05),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.02),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: medalColor ?? Colors.grey[50],
              shape: BoxShape.circle,
            ),
            child: Center(
              child: Text(
                position.toString(),
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  color: medalColor != null ? Colors.white : AppColors.textSecondary,
                ),
              ),
            ),
          ),
          const SizedBox(width: 16),
          // User Avatar in Ranking
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: AppColors.primary.withOpacity(0.1),
              shape: BoxShape.circle,
            ),
            child: ClipOval(
              child: userData['photoURL'] != null
                  ? Image.network(userData['photoURL'], fit: BoxFit.cover)
                  : Center(
                      child: Text(
                        ((userData['displayName'] as String?)?.isNotEmpty == true
                            ? (userData['displayName'] as String)[0]
                            : 'U').toUpperCase(),
                        style: const TextStyle(
                          color: AppColors.primary,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  userData['displayName'] ?? 'Usuário',
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                ),
                Text(
                  'Base: ${userData['baseId'] ?? 'N/A'}',
                  style: const TextStyle(color: AppColors.textSecondary, fontSize: 12),
                ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '${userData['xp'] ?? 0}',
                style: const TextStyle(
                  color: AppColors.primary,
                  fontWeight: FontWeight.bold,
                  fontSize: 18,
                ),
              ),
              const Text(
                'XP',
                style: TextStyle(color: AppColors.textSecondary, fontSize: 10, fontWeight: FontWeight.bold),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
