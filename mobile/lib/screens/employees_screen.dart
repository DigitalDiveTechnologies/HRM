import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/api_client.dart';
import '../state/app_state.dart';
import '../theme/app_theme.dart';
import '../utils/format.dart';
import '../widgets/ui_kit.dart';

class EmployeesScreen extends StatefulWidget {
  const EmployeesScreen({super.key});

  @override
  State<EmployeesScreen> createState() => _EmployeesScreenState();
}

class _EmployeesScreenState extends State<EmployeesScreen> {
  List<dynamic> rows = [];
  bool loading = true;
  String? error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      loading = true;
      error = null;
    });
    final api = context.read<AppState>().api;
    try {
      final data = await api.request('/employees');
      if (!mounted) return;
      setState(() => rows = data as List<dynamic>);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => error = e.message);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.only(bottom: 24),
        children: [
          const PageHero(
            title: 'Employees',
            subtitle: 'Profiles, org info, ID / passport / visa',
            trailing: Icon(Icons.badge_outlined, color: Colors.white, size: 34),
          ),
          if (error != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Text(error!, style: const TextStyle(color: AppColors.danger)),
            ),
          if (loading) const Padding(padding: EdgeInsets.all(32), child: Center(child: CircularProgressIndicator())),
          if (!loading && rows.isEmpty) const EmptyHint('No employees found.'),
          ...rows.map((raw) {
            final e = Map<String, dynamic>.from(raw as Map);
            final name = pick(e, ['fullName', 'full_name']);
            return Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: SectionCard(
                child: Row(
                  children: [
                    InitialsAvatar(name, size: 48),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(name, style: const TextStyle(fontWeight: FontWeight.w800)),
                          Text(
                            '${pick(e, ['empCode', 'emp_code'])} · ${pick(e, ['jobTitle', 'job_title'], '')}',
                            style: TextStyle(color: T.muted(context), fontSize: 12.5),
                          ),
                          Text(
                            pick(e, ['departmentName', 'department_name'], ''),
                            style: TextStyle(color: T.muted(context), fontSize: 12),
                          ),
                        ],
                      ),
                    ),
                    StatusChip(pick(e, ['status'], 'active')),
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
