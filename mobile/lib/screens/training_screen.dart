import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/api_client.dart';
import '../state/app_state.dart';
import '../theme/app_theme.dart';
import '../utils/format.dart';
import '../widgets/ui_kit.dart';

class TrainingScreen extends StatefulWidget {
  const TrainingScreen({super.key});

  @override
  State<TrainingScreen> createState() => _TrainingScreenState();
}

class _TrainingScreenState extends State<TrainingScreen> {
  List<dynamic> courses = [];
  List<dynamic> enrollments = [];
  List<dynamic> certs = [];
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
      final c = await api.request('/training/courses');
      final e = await api.request('/training/enrollments');
      final cert = await api.request('/training/certifications');
      if (!mounted) return;
      setState(() {
        courses = c as List<dynamic>;
        enrollments = e as List<dynamic>;
        certs = cert as List<dynamic>;
      });
    } on ApiException catch (ex) {
      if (!mounted) return;
      setState(() => error = ex.message);
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
            title: 'Training',
            subtitle: 'Courses, enrollments & certifications',
            trailing: Icon(Icons.school_outlined, color: Colors.white, size: 34),
          ),
          if (error != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Text(error!, style: const TextStyle(color: AppColors.danger)),
            ),
          if (loading) const Padding(padding: EdgeInsets.all(32), child: Center(child: CircularProgressIndicator())),
          if (!loading) ...[
            const Padding(
              padding: EdgeInsets.fromLTRB(16, 8, 16, 8),
              child: Text('Courses', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
            ),
            if (courses.isEmpty) const EmptyHint('No courses yet.'),
            ...courses.map((raw) {
              final c = Map<String, dynamic>.from(raw as Map);
              return Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: SectionCard(
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(pick(c, ['title']), style: const TextStyle(fontWeight: FontWeight.w800)),
                            Text(
                              '${pick(c, ['category'], '-')} · ${pick(c, ['durationHours', 'duration_hours'], '0')}h · ${pick(c, ['enrollmentCount', 'enrollment_count'], '0')} enrolled',
                              style: TextStyle(color: T.muted(context), fontSize: 12.5),
                            ),
                          ],
                        ),
                      ),
                      StatusChip(pick(c, ['status'])),
                    ],
                  ),
                ),
              );
            }),
            const Padding(
              padding: EdgeInsets.fromLTRB(16, 16, 16, 8),
              child: Text('Enrollments', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
            ),
            if (enrollments.isEmpty) const EmptyHint('No enrollments yet.'),
            ...enrollments.map((raw) {
              final e = Map<String, dynamic>.from(raw as Map);
              return Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: SectionCard(
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(pick(e, ['fullName', 'full_name']), style: const TextStyle(fontWeight: FontWeight.w800)),
                            Text(
                              pick(e, ['courseTitle', 'course_title']),
                              style: TextStyle(color: T.muted(context), fontSize: 12.5),
                            ),
                            Text(
                              'Due ${formatDate(e['dueDate'] ?? e['due_date'])}',
                              style: TextStyle(color: T.muted(context), fontSize: 12),
                            ),
                          ],
                        ),
                      ),
                      StatusChip(pick(e, ['status'])),
                    ],
                  ),
                ),
              );
            }),
            const Padding(
              padding: EdgeInsets.fromLTRB(16, 16, 16, 8),
              child: Text('Certifications', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
            ),
            if (certs.isEmpty) const EmptyHint('No certifications yet.'),
            ...certs.map((raw) {
              final c = Map<String, dynamic>.from(raw as Map);
              return Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: SectionCard(
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(pick(c, ['name']), style: const TextStyle(fontWeight: FontWeight.w800)),
                            Text(
                              '${pick(c, ['fullName', 'full_name'])} · ${pick(c, ['issuer'], '-')}',
                              style: TextStyle(color: T.muted(context), fontSize: 12.5),
                            ),
                            Text(
                              'Expires ${formatDate(c['expiresOn'] ?? c['expires_on'])}',
                              style: TextStyle(color: T.muted(context), fontSize: 12),
                            ),
                          ],
                        ),
                      ),
                      StatusChip(pick(c, ['status'])),
                    ],
                  ),
                ),
              );
            }),
          ],
        ],
      ),
    );
  }
}
