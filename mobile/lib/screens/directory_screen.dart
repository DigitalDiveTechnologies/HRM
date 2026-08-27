import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/api_client.dart';
import '../state/app_state.dart';
import '../theme/app_theme.dart';
import '../utils/format.dart';
import '../widgets/ui_kit.dart';

class DirectoryScreen extends StatefulWidget {
  const DirectoryScreen({super.key});

  @override
  State<DirectoryScreen> createState() => _DirectoryScreenState();
}

class _DirectoryScreenState extends State<DirectoryScreen> {
  List<dynamic> rows = [];
  List<dynamic> filtered = [];
  bool loading = true;
  String? error;
  final _q = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _q.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final data = await context.read<AppState>().api.request('/employees/directory');
      setState(() {
        rows = data as List<dynamic>;
        filtered = rows;
      });
    } on ApiException catch (e) {
      setState(() => error = e.message);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  void _filter(String q) {
    final query = q.trim().toLowerCase();
    setState(() {
      if (query.isEmpty) {
        filtered = rows;
        return;
      }
      filtered = rows.where((raw) {
        final e = Map<String, dynamic>.from(raw as Map);
        final hay =
            '${pick(e, ['fullName', 'full_name'])} ${pick(e, ['jobTitle', 'job_title'])} ${pick(e, ['departmentName', 'department_name'])} ${pick(e, ['email'])}'
                .toLowerCase();
        return hay.contains(query);
      }).toList();
    });
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.only(bottom: 110),
        children: [
          PageHero(
            title: 'Directory',
            subtitle: '${rows.length} teammates · search by name or team',
            trailing: const Icon(Icons.groups_rounded, color: Colors.white, size: 36),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: SectionCard(
              margin: EdgeInsets.zero,
              padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
              child: TextField(
                controller: _q,
                onChanged: _filter,
                decoration: const InputDecoration(
                  hintText: 'Search name, role, department…',
                  prefixIcon: Icon(Icons.search_rounded),
                  border: InputBorder.none,
                  enabledBorder: InputBorder.none,
                  focusedBorder: InputBorder.none,
                  filled: false,
                ),
              ),
            ),
          ),
          const SizedBox(height: 14),
          if (error != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Text(error!, style: const TextStyle(color: AppColors.danger)),
            ),
          if (loading) const Padding(padding: EdgeInsets.all(32), child: Center(child: CircularProgressIndicator())),
          if (!loading && filtered.isEmpty) const EmptyHint('No people found.', icon: Icons.person_search_outlined),
          ...filtered.map((raw) {
            final e = Map<String, dynamic>.from(raw as Map);
            final name = pick(e, ['fullName', 'full_name']);
            final title = pick(e, ['jobTitle', 'job_title'], '');
            final dept = pick(e, ['departmentName', 'department_name'], '');
            return Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: SectionCard(
                child: Row(
                  children: [
                    InitialsAvatar(name, size: 52),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(name, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
                          const SizedBox(height: 3),
                          Text(
                            [title, dept].where((s) => s.isNotEmpty).join(' · '),
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                          const SizedBox(height: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: AppColors.accent.withValues(alpha: 0.1),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text(
                              pick(e, ['email']),
                              style: const TextStyle(color: AppColors.accent, fontSize: 12, fontWeight: FontWeight.w600),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            );
          }),
        ],
      ),
    );
  }
}
