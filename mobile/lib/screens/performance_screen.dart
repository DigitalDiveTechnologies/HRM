import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/api_client.dart';
import '../state/app_state.dart';
import '../theme/app_theme.dart';
import '../utils/format.dart';
import '../widgets/ui_kit.dart';

class PerformanceScreen extends StatefulWidget {
  const PerformanceScreen({super.key});

  @override
  State<PerformanceScreen> createState() => _PerformanceScreenState();
}

class _PerformanceScreenState extends State<PerformanceScreen> {
  List<dynamic> goals = [];
  List<dynamic> reviews = [];
  List<dynamic> peerReviews = [];
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
      final g = await api.request('/performance/goals');
      final r = await api.request('/performance/reviews');

      List<dynamic> p = [];
      try {
        final pr = await api.request('/performance/my-peer-reviews');
        p = pr as List<dynamic>;
      } on ApiException catch (e) {
        if (e.statusCode == 404) {
          try {
            final pr = await api.request('/performance/reviews/360-pending');
            p = pr as List<dynamic>;
          } catch (_) {
            p = [];
          }
        }
      } catch (_) {
        p = [];
      }

      if (!mounted) return;
      setState(() {
        goals = g as List<dynamic>;
        reviews = r as List<dynamic>;
        peerReviews = p;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => error = e.message);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  void _openPeerFeedbackDialog(Map<String, dynamic> item) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => _PeerFeedbackSheet(
        nomination: item,
        onSubmitted: () {
          _load();
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    // Separate root goals from child sub-goals
    final rootGoals = <Map<String, dynamic>>[];
    final childGoalsMap = <String, List<Map<String, dynamic>>>{};

    for (final raw in goals) {
      final g = Map<String, dynamic>.from(raw as Map);
      final parentId = (g['parent_goal_id'] ?? g['parentGoalId'])?.toString();
      if (parentId == null || parentId.isEmpty || parentId == '0') {
        rootGoals.add(g);
      } else {
        childGoalsMap.putIfAbsent(parentId, () => []).add(g);
      }
    }

    // Include any goals whose parent is not in rootGoals as standalone
    final rootIds = rootGoals.map((g) => g['id']?.toString()).toSet();
    for (final entry in childGoalsMap.entries) {
      if (!rootIds.contains(entry.key)) {
        rootGoals.addAll(entry.value);
      }
    }

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: screenListPadding(context),
        children: [
          const PageHero(
            title: 'Performance & OKRs',
            subtitle: 'Goals, 360 peer feedback, and appraisal reviews',
            trailing: Icon(Icons.emoji_events_outlined, color: Colors.white, size: 36),
          ),

          if (error != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Text(error!, style: const TextStyle(color: AppColors.danger)),
            ),

          if (loading) const ScreenLoader(),

          if (!loading) ...[
            // ==========================================
            // Section 1: 360-Degree Peer Reviews
            // ==========================================
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
              child: Row(
                children: [
                  const Icon(Icons.rate_review_outlined, size: 20, color: AppColors.accent),
                  const SizedBox(width: 8),
                  const Text(
                    '360 Peer Feedback',
                    style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
                  ),
                  if (peerReviews.isNotEmpty) ...[
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: AppColors.warn,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        '${peerReviews.length} pending',
                        style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w800),
                      ),
                    ),
                  ],
                ],
              ),
            ),

            if (peerReviews.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: SectionCard(
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: AppColors.ok.withValues(alpha: 0.12),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.check_circle_outline, color: AppColors.ok, size: 22),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'All Peer Reviews Completed',
                              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              'You have no pending 360-degree feedback requests at this time.',
                              style: TextStyle(color: T.muted(context), fontSize: 12),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              )
            else
              ...peerReviews.map((raw) {
                final p = Map<String, dynamic>.from(raw as Map);
                final nomineeName = pick(p, ['nominee_name', 'nomineeName', 'fullName', 'full_name'], 'Colleague');
                final nomineeTitle = pick(p, ['nominee_title', 'nomineeTitle', 'jobTitle', 'job_title'], 'Team Member');
                final reviewType = pick(p, ['review_type', 'reviewType'], 'Appraisal Cycle').replaceAll('_', ' ');
                final isAnon = p['is_anonymous'] == true || p['isAnonymous'] == true;

                return Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: SectionCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            InitialsAvatar(nomineeName, size: 42),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    nomineeName,
                                    style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    nomineeTitle,
                                    style: TextStyle(color: T.muted(context), fontSize: 12),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    'Cycle: $reviewType',
                                    style: TextStyle(color: AppColors.accent, fontSize: 11.5, fontWeight: FontWeight.w600),
                                  ),
                                ],
                              ),
                            ),
                            const StatusChip('pending'),
                          ],
                        ),
                        const SizedBox(height: 12),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Row(
                              children: [
                                Icon(
                                  isAnon ? Icons.lock_outline : Icons.lock_open_outlined,
                                  size: 14,
                                  color: T.muted(context),
                                ),
                                const SizedBox(width: 4),
                                Text(
                                  isAnon ? 'Anonymous Review' : 'Named Review',
                                  style: TextStyle(color: T.muted(context), fontSize: 11.5),
                                ),
                              ],
                            ),
                            FilledButton.icon(
                              onPressed: () => _openPeerFeedbackDialog(p),
                              icon: const Icon(Icons.rate_review_rounded, size: 16),
                              label: const Text('Provide Feedback'),
                              style: FilledButton.styleFrom(
                                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                                visualDensity: VisualDensity.compact,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                );
              }),

            const SizedBox(height: 12),

            // ==========================================
            // Section 2: Goals & Hierarchical Sub-goals
            // ==========================================
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
              child: Row(
                children: [
                  const Icon(Icons.flag_outlined, size: 20, color: AppColors.accent),
                  const SizedBox(width: 8),
                  const Text(
                    'Goals & Key Results (OKRs)',
                    style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
                  ),
                ],
              ),
            ),

            if (goals.isEmpty) const EmptyHint('No goals assigned yet.'),

            ...rootGoals.map((g) {
              final idStr = g['id']?.toString() ?? '';
              final subGoals = childGoalsMap[idStr] ?? [];
              final progress = pick(g, ['progressPct', 'progress_pct'], '0');
              final progressVal = ((double.tryParse(progress) ?? 0) / 100).clamp(0.0, 1.0);
              final weight = g['weightage'] != null ? '${g['weightage']}%' : null;
              final targetMetric = pick(g, ['targetMetric', 'target_metric', 'targetValue', 'target_value']);
              final currentMetric = pick(g, ['currentMetric', 'current_metric']);

              return Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: SectionCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Goal header
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Expanded(
                                      child: Text(
                                        pick(g, ['title']),
                                        style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15.5),
                                      ),
                                    ),
                                    if (weight != null) ...[
                                      const SizedBox(width: 6),
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                        decoration: BoxDecoration(
                                          color: AppColors.accent.withValues(alpha: 0.12),
                                          borderRadius: BorderRadius.circular(6),
                                        ),
                                        child: Text(
                                          'Weight: $weight',
                                          style: const TextStyle(
                                            color: AppColors.accent,
                                            fontWeight: FontWeight.w700,
                                            fontSize: 10.5,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ],
                                ),
                                const SizedBox(height: 3),
                                Text(
                                  '${pick(g, ['fullName', 'full_name'])} · ${pick(g, ['periodLabel', 'period_label'], '-')}',
                                  style: TextStyle(color: T.muted(context), fontSize: 12),
                                ),
                                if (g['kpi'] != null && g['kpi'].toString().isNotEmpty) ...[
                                  const SizedBox(height: 2),
                                  Text(
                                    'KPI: ${pick(g, ['kpi'])}'
                                    '${targetMetric.isNotEmpty ? ' · Target: $targetMetric' : ''}'
                                    '${currentMetric.isNotEmpty ? ' · Current: $currentMetric' : ''}',
                                    style: TextStyle(color: T.muted(context), fontSize: 11.5),
                                  ),
                                ],
                              ],
                            ),
                          ),
                          const SizedBox(width: 8),
                          StatusChip(pick(g, ['status'])),
                        ],
                      ),
                      const SizedBox(height: 10),

                      // Progress bar
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text('Overall Progress', style: TextStyle(color: T.muted(context), fontSize: 12)),
                          Text(
                            '$progress%',
                            style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13, color: AppColors.accent),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      LinearProgressIndicator(
                        value: progressVal,
                        minHeight: 7,
                        borderRadius: BorderRadius.circular(4),
                        backgroundColor: AppColors.accent.withValues(alpha: 0.15),
                        valueColor: const AlwaysStoppedAnimation<Color>(AppColors.accent),
                      ),

                      // Nested Sub-goals / Key Results
                      if (subGoals.isNotEmpty) ...[
                        const SizedBox(height: 14),
                        const Divider(height: 1),
                        const SizedBox(height: 10),
                        Row(
                          children: [
                            const Icon(Icons.subdirectory_arrow_right_rounded, size: 16, color: AppColors.accent),
                            const SizedBox(width: 4),
                            Text(
                              'Key Results & Sub-goals (${subGoals.length})',
                              style: TextStyle(
                                fontWeight: FontWeight.w700,
                                fontSize: 12.5,
                                color: T.ink(context),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        ...subGoals.map((sg) {
                          final sgProgress = pick(sg, ['progressPct', 'progress_pct'], '0');
                          final sgVal = ((double.tryParse(sgProgress) ?? 0) / 100).clamp(0.0, 1.0);
                          final sgWeight = sg['weightage'] != null ? '${sg['weightage']}%' : null;
                          final sgTarget = pick(sg, ['targetMetric', 'target_metric', 'targetValue', 'target_value']);
                          final sgCurrent = pick(sg, ['currentMetric', 'current_metric']);
                          final sgDue = pick(sg, ['dueDate', 'due_date']);

                          return Container(
                            margin: const EdgeInsets.only(bottom: 8),
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              color: T.surface(context).withValues(alpha: 0.7),
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(color: T.cardBorder(context)),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Expanded(
                                      child: Text(
                                        pick(sg, ['title']),
                                        style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
                                      ),
                                    ),
                                    if (sgWeight != null) ...[
                                      Text(
                                        'Weight: $sgWeight',
                                        style: TextStyle(color: T.muted(context), fontSize: 10.5, fontWeight: FontWeight.w600),
                                      ),
                                      const SizedBox(width: 6),
                                    ],
                                    StatusChip(pick(sg, ['status'])),
                                  ],
                                ),
                                if (sgTarget.isNotEmpty || sgCurrent.isNotEmpty || sgDue.isNotEmpty) ...[
                                  const SizedBox(height: 3),
                                  Row(
                                    children: [
                                      if (sgCurrent.isNotEmpty || sgTarget.isNotEmpty)
                                        Expanded(
                                          child: Text(
                                            'Metric: ${sgCurrent.isNotEmpty ? sgCurrent : '0'} / ${sgTarget.isNotEmpty ? sgTarget : '—'}',
                                            style: TextStyle(color: T.muted(context), fontSize: 11),
                                          ),
                                        ),
                                      if (sgDue.isNotEmpty)
                                        Text(
                                          'Due: ${formatDate(sgDue)}',
                                          style: TextStyle(color: T.muted(context), fontSize: 11),
                                        ),
                                    ],
                                  ),
                                ],
                                const SizedBox(height: 6),
                                Row(
                                  children: [
                                    Expanded(
                                      child: LinearProgressIndicator(
                                        value: sgVal,
                                        minHeight: 5,
                                        borderRadius: BorderRadius.circular(3),
                                        backgroundColor: AppColors.accent.withValues(alpha: 0.12),
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    Text(
                                      '$sgProgress%',
                                      style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: T.muted(context)),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          );
                        }),
                      ],
                    ],
                  ),
                ),
              );
            }),

            // ==========================================
            // Section 3: Appraisal Reviews
            // ==========================================
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
              child: Row(
                children: [
                  const Icon(Icons.assessment_outlined, size: 20, color: AppColors.accent),
                  const SizedBox(width: 8),
                  const Text('Appraisal Reviews', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
                ],
              ),
            ),

            if (reviews.isEmpty) const EmptyHint('No reviews completed yet.'),

            ...reviews.map((raw) {
              final r = Map<String, dynamic>.from(raw as Map);
              final type = pick(r, ['reviewType', 'review_type']).replaceAll('_', ' ');
              final summary = pick(r, ['summary'], '');

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
                                Text(pick(r, ['fullName', 'full_name']), style: const TextStyle(fontWeight: FontWeight.w800)),
                                Text(
                                  '$type · ${pick(r, ['reviewerName', 'reviewer_name'], '—')} · Rating ${pick(r, ['rating'], '-')}',
                                  style: TextStyle(color: T.muted(context), fontSize: 12.5),
                                ),
                                Text(
                                  formatDate(r['reviewDate'] ?? r['review_date']),
                                  style: TextStyle(color: T.muted(context), fontSize: 12),
                                ),
                              ],
                            ),
                          ),
                          StatusChip(pick(r, ['status'])),
                        ],
                      ),
                      if (summary.isNotEmpty) ...[
                        const SizedBox(height: 8),
                        Text(summary, style: TextStyle(color: T.muted(context), fontSize: 12.5)),
                      ],
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

class _PeerFeedbackSheet extends StatefulWidget {
  const _PeerFeedbackSheet({required this.nomination, required this.onSubmitted});
  final Map<String, dynamic> nomination;
  final VoidCallback onSubmitted;

  @override
  State<_PeerFeedbackSheet> createState() => _PeerFeedbackSheetState();
}

class _PeerFeedbackSheetState extends State<_PeerFeedbackSheet> {
  int rating = 4;
  final _commentsCtrl = TextEditingController();
  bool isAnonymous = true;
  bool submitting = false;
  String? error;

  final ratingLabels = const {
    1: '1 - Needs Improvement',
    2: '2 - Developing',
    3: '3 - Proficient',
    4: '4 - Exceeds Expectations',
    5: '5 - Outstanding Role Model',
  };

  @override
  void dispose() {
    _commentsCtrl.dispose();
    super.dispose();
  }

  Future<void> _submitFeedback() async {
    final comments = _commentsCtrl.text.trim();
    if (comments.isEmpty) {
      setState(() => error = 'Please provide constructive feedback comments.');
      return;
    }

    setState(() {
      submitting = true;
      error = null;
    });

    final api = context.read<AppState>().api;
    final nominationId = widget.nomination['id'];
    final reviewId = widget.nomination['review_id'] ?? widget.nomination['reviewId'];

    final payload = {
      'feedbackJson': {
        'rating': rating,
        'comments': comments,
        'isAnonymous': isAnonymous,
      },
      'rating': rating,
      'comments': comments,
      'isAnonymous': isAnonymous,
    };

    try {
      try {
        await api.request(
          '/performance/peer-nominations/$nominationId/submit',
          method: 'POST',
          body: payload,
        );
      } on ApiException catch (e) {
        if (e.statusCode == 404 && reviewId != null) {
          await api.request(
            '/performance/reviews/$reviewId/peer-feedback',
            method: 'POST',
            body: payload,
          );
        } else {
          rethrow;
        }
      }

      if (!mounted) return;
      Navigator.of(context).pop();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('360 Peer Feedback submitted successfully.'),
          backgroundColor: AppColors.ok,
        ),
      );
      widget.onSubmitted();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => error = e.message);
    } catch (e) {
      if (!mounted) return;
      setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.viewInsetsOf(context).bottom;
    final nomineeName = pick(widget.nomination, ['nominee_name', 'nomineeName', 'fullName', 'full_name'], 'Colleague');
    final nomineeTitle = pick(widget.nomination, ['nominee_title', 'nomineeTitle', 'jobTitle', 'job_title'], 'Colleague');

    return SafeArea(
      child: Container(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.sizeOf(context).height * 0.88,
        ),
        decoration: BoxDecoration(
          color: T.surface(context),
          borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        ),
        padding: EdgeInsets.fromLTRB(20, 16, 20, 20 + bottomInset),
        child: SingleChildScrollView(
          child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 44,
                height: 4,
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(
                  color: T.muted(context).withValues(alpha: 0.3),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '360 Peer Evaluation',
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'Provide feedback for $nomineeName ($nomineeTitle)',
                        style: TextStyle(color: T.muted(context), fontSize: 12.5),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  onPressed: () => Navigator.of(context).pop(),
                  icon: const Icon(Icons.close),
                ),
              ],
            ),
            const SizedBox(height: 14),

            if (error != null) ...[
              Container(
                padding: const EdgeInsets.all(10),
                margin: const EdgeInsets.only(bottom: 12),
                decoration: BoxDecoration(
                  color: AppColors.danger.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: AppColors.danger.withValues(alpha: 0.3)),
                ),
                child: Text(error!, style: const TextStyle(color: AppColors.danger, fontSize: 13)),
              ),
            ],

            // Competency Rating Chips (1-5)
            const Text(
              'Competency & Collaboration Rating',
              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 6,
              children: [1, 2, 3, 4, 5].map((score) {
                final isSelected = rating == score;
                return ChoiceChip(
                  label: Text('$score ★'),
                  selected: isSelected,
                  onSelected: (_) => setState(() => rating = score),
                  selectedColor: AppColors.accent,
                  labelStyle: TextStyle(
                    color: isSelected ? Colors.white : T.ink(context),
                    fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                  ),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                );
              }).toList(),
            ),
            const SizedBox(height: 4),
            Text(
              ratingLabels[rating] ?? '',
              style: const TextStyle(color: AppColors.accent, fontWeight: FontWeight.w700, fontSize: 12.5),
            ),
            const SizedBox(height: 16),

            // Comments
            TextFormField(
              controller: _commentsCtrl,
              maxLines: 4,
              decoration: const InputDecoration(
                labelText: 'Constructive Feedback & Key Strengths',
                hintText: 'Highlight contributions, collaboration impact, and areas for professional development...',
                alignLabelWithHint: true,
              ),
            ),
            const SizedBox(height: 12),

            // Anonymous review checkbox
            CheckboxListTile(
              value: isAnonymous,
              onChanged: (val) => setState(() => isAnonymous = val ?? true),
              title: const Text(
                '🔒 Anonymous Peer Review',
                style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5),
              ),
              subtitle: Text(
                'Your name will not be disclosed to the reviewee.',
                style: TextStyle(color: T.muted(context), fontSize: 11.5),
              ),
              controlAffinity: ListTileControlAffinity.leading,
              contentPadding: EdgeInsets.zero,
              activeColor: AppColors.accent,
            ),
            const SizedBox(height: 16),

            // Submit Button
            FilledButton.icon(
              onPressed: submitting ? null : _submitFeedback,
              icon: submitting
                  ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Icon(Icons.send_rounded),
              label: Text(submitting ? 'Submitting Evaluation…' : 'Submit Evaluation'),
              style: FilledButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 14),
              ),
            ),
          ],
        ),
      ),
    ),
  );
  }
}
