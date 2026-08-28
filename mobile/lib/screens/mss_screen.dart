import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/api_client.dart';
import '../state/app_state.dart';
import '../theme/app_theme.dart';
import '../utils/format.dart';
import '../widgets/ui_kit.dart';

class MssScreen extends StatefulWidget {
  const MssScreen({super.key});

  @override
  State<MssScreen> createState() => _MssScreenState();
}

class _MssScreenState extends State<MssScreen> {
  Map<String, dynamic>? summary;
  List<dynamic> team = [];
  List<dynamic> leave = [];
  List<dynamic> attendance = [];
  List<dynamic> approvals = [];
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
      final s = await api.request('/mss/summary');
      final t = await api.request('/mss/team');
      final l = await api.request('/mss/leave');
      final a = await api.request('/mss/attendance');
      final ap = await api.request('/mss/approvals');
      if (!mounted) return;
      setState(() {
        summary = Map<String, dynamic>.from(s as Map);
        team = t as List<dynamic>;
        leave = l as List<dynamic>;
        attendance = a as List<dynamic>;
        approvals = ap as List<dynamic>;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => error = e.message);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _setApproval(dynamic id, String status) async {
    try {
      await context.read<AppState>().api.request(
            '/mss/approvals/$id',
            method: 'PATCH',
            body: {'status': status},
          );
      await _load();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => error = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = summary ?? {};
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: screenListPadding(context),
        children: [
          const PageHero(
            title: 'Manager Self-Service',
            subtitle: 'Your team, leave & approvals',
            trailing: Icon(Icons.supervisor_account_outlined, color: Colors.white, size: 34),
          ),
          if (error != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Text(error!, style: const TextStyle(color: AppColors.danger)),
            ),
          if (loading) const ScreenLoader(),
          if (!loading) ...[
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Wrap(
                spacing: 10,
                runSpacing: 10,
                children: [
                  _StatChip('Team', pick(s, ['teamCount', 'team_count'], '0')),
                  _StatChip('Pending leave', pick(s, ['pendingLeave', 'pending_leave'], '0')),
                  _StatChip('Approvals', pick(s, ['pendingApprovals', 'pending_approvals'], '0')),
                  _StatChip('On leave', pick(s, ['onLeaveToday', 'on_leave_today'], '0')),
                ],
              ),
            ),
            const Padding(
              padding: EdgeInsets.fromLTRB(16, 16, 16, 8),
              child: Text('My team', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
            ),
            if (team.isEmpty) const EmptyHint('No direct reports linked.'),
            ...team.map((raw) {
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
                              '${pick(e, ['jobTitle', 'job_title'], '-')} · ${pick(e, ['departmentName', 'department_name'], '-')}',
                              style: TextStyle(color: T.muted(context), fontSize: 12.5),
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
              child: Text('Team approvals', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
            ),
            if (approvals.isEmpty) const EmptyHint('No team approvals.'),
            ...approvals.map((raw) {
              final a = Map<String, dynamic>.from(raw as Map);
              final status = pick(a, ['status']);
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
                                Text(pick(a, ['title']), style: const TextStyle(fontWeight: FontWeight.w800)),
                                Text(
                                  '${pick(a, ['fullName', 'full_name'])} · ${pick(a, ['requestType', 'request_type'])}',
                                  style: TextStyle(color: T.muted(context), fontSize: 12.5),
                                ),
                              ],
                            ),
                          ),
                          StatusChip(status),
                        ],
                      ),
                      if (status.toLowerCase() == 'pending') ...[
                        const SizedBox(height: 10),
                        Row(
                          children: [
                            TextButton(
                              onPressed: () => _setApproval(a['id'], 'approved'),
                              child: const Text('Approve'),
                            ),
                            TextButton(
                              onPressed: () => _setApproval(a['id'], 'rejected'),
                              child: Text('Reject', style: TextStyle(color: AppColors.danger)),
                            ),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),
              );
            }),
            const Padding(
              padding: EdgeInsets.fromLTRB(16, 16, 16, 8),
              child: Text('Team leave', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
            ),
            if (leave.isEmpty) const EmptyHint('No team leave.'),
            ...leave.take(8).map((raw) {
              final l = Map<String, dynamic>.from(raw as Map);
              return Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: SectionCard(
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(pick(l, ['fullName', 'full_name']), style: const TextStyle(fontWeight: FontWeight.w800)),
                            Text(
                              '${pick(l, ['leaveType', 'leave_type'])} · ${formatDate(l['startDate'] ?? l['start_date'])} → ${formatDate(l['endDate'] ?? l['end_date'])}',
                              style: TextStyle(color: T.muted(context), fontSize: 12.5),
                            ),
                          ],
                        ),
                      ),
                      StatusChip(pick(l, ['status'])),
                    ],
                  ),
                ),
              );
            }),
            const Padding(
              padding: EdgeInsets.fromLTRB(16, 16, 16, 8),
              child: Text('Recent attendance', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
            ),
            if (attendance.isEmpty) const EmptyHint('No team attendance.'),
            ...attendance.take(10).map((raw) {
              final a = Map<String, dynamic>.from(raw as Map);
              return Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: SectionCard(
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(pick(a, ['fullName', 'full_name']), style: const TextStyle(fontWeight: FontWeight.w800)),
                            Text(
                              formatDate(a['workDate'] ?? a['work_date']),
                              style: TextStyle(color: T.muted(context), fontSize: 12.5),
                            ),
                          ],
                        ),
                      ),
                      StatusChip(pick(a, ['status'])),
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

class _StatChip extends StatelessWidget {
  const _StatChip(this.label, this.value);
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 150,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: T.surface(context),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: T.cardBorder(context)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: TextStyle(color: T.muted(context), fontSize: 11.5)),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 20)),
        ],
      ),
    );
  }
}
