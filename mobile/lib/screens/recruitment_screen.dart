import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../nav/app_nav.dart';
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
  List<dynamic> interviews = [];
  List<dynamic> offers = [];
  bool loading = true;
  String? error;
  String? msg;

  String interviewCandidateId = '';
  String scheduledAt = '';
  String interviewer = '';
  String offerCandidateId = '';
  String salary = '';
  String joinDate = todayIso();

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
      final i = await api.request('/recruitment/interviews');
      final o = await api.request('/recruitment/offers');
      if (!mounted) return;
      setState(() {
        jobs = j as List<dynamic>;
        candidates = c as List<dynamic>;
        interviews = i as List<dynamic>;
        offers = o as List<dynamic>;
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

  Future<void> _scheduleInterview() async {
    if (interviewCandidateId.isEmpty || scheduledAt.isEmpty) {
      setState(() => error = 'Candidate and schedule time required.');
      return;
    }
    try {
      await context.read<AppState>().api.request(
            '/recruitment/interviews',
            method: 'POST',
            body: {
              'candidateId': int.parse(interviewCandidateId),
              'scheduledAt': scheduledAt.contains('T') ? scheduledAt : '${scheduledAt}T10:00:00Z',
              'interviewer': interviewer,
              'mode': 'Online',
            },
          );
      setState(() {
        msg = 'Interview scheduled.';
        interviewCandidateId = '';
        scheduledAt = '';
        interviewer = '';
      });
      await _load();
    } on ApiException catch (e) {
      setState(() => error = e.message);
    }
  }

  Future<void> _createOffer() async {
    if (offerCandidateId.isEmpty) {
      setState(() => error = 'Select a candidate.');
      return;
    }
    try {
      await context.read<AppState>().api.request(
            '/recruitment/offers',
            method: 'POST',
            body: {
              'candidateId': int.parse(offerCandidateId),
              'salary': num.tryParse(salary) ?? 0,
              'currency': currencyCode(),
              'joinDate': joinDate,
              'status': 'pending',
            },
          );
      setState(() {
        msg = 'Offer created.';
        offerCandidateId = '';
        salary = '';
      });
      await _load();
    } on ApiException catch (e) {
      setState(() => error = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isAdmin = normalizeRole(context.watch<AppState>().user?.role) == 'admin';

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: screenListPadding(context),
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
          if (msg != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Text(msg!, style: const TextStyle(color: AppColors.ok, fontWeight: FontWeight.w600)),
            ),
          if (loading) const ScreenLoader(),
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
          if (isAdmin) ...[
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: SectionCard(
                child: FormSpacedColumn(
                  children: [
                    Text('Schedule interview', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
                    DropdownButtonFormField<String>(
                      initialValue: interviewCandidateId.isEmpty ? null : interviewCandidateId,
                      decoration: const InputDecoration(labelText: 'Candidate'),
                      items: candidates
                          .map((raw) {
                            final c = Map<String, dynamic>.from(raw as Map);
                            return DropdownMenuItem(value: '${c['id']}', child: Text(pick(c, ['fullName', 'full_name'])));
                          })
                          .toList(),
                      onChanged: (v) => setState(() => interviewCandidateId = v ?? ''),
                    ),
                    TextFormField(
                      decoration: const InputDecoration(labelText: 'When (YYYY-MM-DDTHH:mm:ssZ)'),
                      onChanged: (v) => scheduledAt = v,
                    ),
                    TextFormField(decoration: const InputDecoration(labelText: 'Interviewer'), onChanged: (v) => interviewer = v),
                    FilledButton(onPressed: _scheduleInterview, child: const Text('Schedule')),
                  ],
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: SectionCard(
                child: FormSpacedColumn(
                  children: [
                    Text('Create offer', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
                    DropdownButtonFormField<String>(
                      initialValue: offerCandidateId.isEmpty ? null : offerCandidateId,
                      decoration: const InputDecoration(labelText: 'Candidate'),
                      items: candidates
                          .map((raw) {
                            final c = Map<String, dynamic>.from(raw as Map);
                            return DropdownMenuItem(value: '${c['id']}', child: Text(pick(c, ['fullName', 'full_name'])));
                          })
                          .toList(),
                      onChanged: (v) => setState(() => offerCandidateId = v ?? ''),
                    ),
                    TextFormField(decoration: const InputDecoration(labelText: 'Salary'), onChanged: (v) => salary = v),
                    TextFormField(initialValue: joinDate, decoration: const InputDecoration(labelText: 'Join date'), onChanged: (v) => joinDate = v),
                    FilledButton(onPressed: _createOffer, child: const Text('Create offer')),
                  ],
                ),
              ),
            ),
          ],
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 8),
            child: Text('Interviews', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
          ),
          if (!loading && interviews.isEmpty) const EmptyHint('No interviews.'),
          ...interviews.map((raw) {
            final i = Map<String, dynamic>.from(raw as Map);
            return Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: SectionCard(
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(pick(i, ['candidateName', 'candidate_name']), style: const TextStyle(fontWeight: FontWeight.w800)),
                          Text(
                            '${formatDate(i['scheduledAt'] ?? i['scheduled_at'])} · ${pick(i, ['interviewer'], '-')}',
                            style: TextStyle(color: T.muted(context), fontSize: 12.5),
                          ),
                        ],
                      ),
                    ),
                    StatusChip(pick(i, ['status'])),
                  ],
                ),
              ),
            );
          }),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 8),
            child: Text('Offers', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
          ),
          if (!loading && offers.isEmpty) const EmptyHint('No offers.'),
          ...offers.map((raw) {
            final o = Map<String, dynamic>.from(raw as Map);
            return Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: SectionCard(
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(pick(o, ['candidateName', 'candidate_name']), style: const TextStyle(fontWeight: FontWeight.w800)),
                          Text(
                            '${money(o['salary'])} · join ${formatDate(o['joinDate'] ?? o['join_date'])}',
                            style: TextStyle(color: T.muted(context), fontSize: 12.5),
                          ),
                        ],
                      ),
                    ),
                    StatusChip(pick(o, ['status'])),
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
