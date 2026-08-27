import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/api_client.dart';
import '../state/app_state.dart';
import '../theme/app_theme.dart';
import '../utils/format.dart';
import '../widgets/ui_kit.dart';

class RecruitmentScreen extends StatefulWidget {
  const RecruitmentScreen({super.key});

  @override
  State<RecruitmentScreen> createState() => _RecruitmentScreenState();
}

class _RecruitmentScreenState extends State<RecruitmentScreen> {
  List<dynamic> jobs = [];
  List<dynamic> candidates = [];
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
      final j = await api.request('/recruitment/jobs');
      final c = await api.request('/recruitment/candidates');
      if (!mounted) return;
      setState(() {
        jobs = j as List<dynamic>;
        candidates = c as List<dynamic>;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => error = e.message);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _setStage(dynamic id, String stage) async {
    try {
      await context.read<AppState>().api.request(
            '/recruitment/candidates/$id',
            method: 'PATCH',
            body: {'stage': stage},
          );
      await _load();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => error = e.message);
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
            title: 'Recruitment',
            subtitle: 'Jobs, candidates & hiring pipeline',
            trailing: Icon(Icons.person_search_rounded, color: Colors.white, size: 34),
          ),
          if (error != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Text(error!, style: const TextStyle(color: AppColors.danger)),
            ),
          if (loading) const Padding(padding: EdgeInsets.all(32), child: Center(child: CircularProgressIndicator())),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
            child: Text('Open roles', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
          ),
          if (!loading && jobs.isEmpty) const EmptyHint('No job postings.'),
          ...jobs.map((raw) {
            final j = Map<String, dynamic>.from(raw as Map);
            return Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: SectionCard(
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(pick(j, ['title']), style: const TextStyle(fontWeight: FontWeight.w800)),
                          Text(
                            '${pick(j, ['department'], '-')} · ${pick(j, ['location'], '-')}',
                            style: TextStyle(color: T.muted(context), fontSize: 12.5),
                          ),
                          Text(
                            '${pick(j, ['candidateCount', 'candidate_count'], '0')} candidates',
                            style: TextStyle(color: T.muted(context), fontSize: 12),
                          ),
                        ],
                      ),
                    ),
                    StatusChip(pick(j, ['status'])),
                  ],
                ),
              ),
            );
          }),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 8),
            child: Text('Pipeline', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
          ),
          if (!loading && candidates.isEmpty) const EmptyHint('No candidates.'),
          ...candidates.map((raw) {
            final c = Map<String, dynamic>.from(raw as Map);
            final id = c['id'];
            return Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: SectionCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(pick(c, ['fullName', 'full_name']), style: const TextStyle(fontWeight: FontWeight.w800)),
                              Text(
                                '${pick(c, ['jobTitle', 'job_title'], '-')} · ${pick(c, ['email'])}',
                                style: TextStyle(color: T.muted(context), fontSize: 12.5),
                              ),
                            ],
                          ),
                        ),
                        StatusChip(pick(c, ['stage'])),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        for (final stage in ['screening', 'interview', 'offer', 'hired', 'rejected'])
                          OutlinedButton(
                            onPressed: () => _setStage(id, stage),
                            style: OutlinedButton.styleFrom(
                              foregroundColor: AppColors.accent,
                              side: BorderSide(color: AppColors.accent.withValues(alpha: 0.4)),
                              visualDensity: VisualDensity.compact,
                            ),
                            child: Text(stage),
                          ),
                      ],
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
