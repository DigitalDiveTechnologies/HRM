import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../data/holidays.dart';
import '../services/api_client.dart';
import '../state/app_state.dart';
import '../theme/app_theme.dart';
import '../utils/format.dart';
import '../widgets/ui_kit.dart';

class LeaveScreen extends StatefulWidget {
  const LeaveScreen({super.key});

  @override
  State<LeaveScreen> createState() => _LeaveScreenState();
}

class _LeaveScreenState extends State<LeaveScreen> {
  List<dynamic> rows = [];
  List<dynamic> balances = [];
  bool loading = true;
  bool submitting = false;
  String? error;
  String? msg;
  String leaveType = 'Annual';
  String startDate = todayIso();
  String endDate = todayIso();
  String days = '1';
  String reason = '';

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
    final user = context.read<AppState>().user;
    final role = (user?.role ?? '').toLowerCase();
    final myId = user?.employeeId;
    try {
      final data = await api.request('/leave') as List<dynamic>;
      final bal = await api.request('/leave/balances') as List<dynamic>;
      final mine = (role == 'employee' && myId != null)
          ? data.where((raw) {
              final r = Map<String, dynamic>.from(raw as Map);
              final id = r['employeeId'] ?? r['employee_id'];
              return id == null || id.toString() == myId.toString();
            }).toList()
          : data;
      final myBal = (role == 'employee' && myId != null)
          ? bal.where((raw) {
              final r = Map<String, dynamic>.from(raw as Map);
              final id = r['employeeId'] ?? r['employee_id'];
              return id == null || id.toString() == myId.toString();
            }).toList()
          : bal;
      if (!mounted) return;
      setState(() {
        rows = mine;
        balances = myBal;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => error = e.message);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _submit() async {
    if (submitting) return;
    final user = context.read<AppState>().user!;
    if (user.employeeId == null) {
      setState(() => error = 'No employee profile linked.');
      return;
    }
    setState(() {
      submitting = true;
      msg = null;
      error = null;
    });
    try {
      await context.read<AppState>().api.request(
            '/leave',
            method: 'POST',
            body: {
              'employeeId': user.employeeId,
              'leaveType': leaveType,
              'startDate': startDate,
              'endDate': endDate,
              'days': num.tryParse(days) ?? 1,
              'reason': reason,
            },
          );
      if (!mounted) return;
      setState(() {
        msg = 'Leave request submitted.';
        reason = '';
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Leave submitted — check Alerts for confirmation.')),
      );
      await _load();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => error = e.message);
    } finally {
      if (mounted) setState(() => submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final pending = rows.where((raw) {
      return pick(Map<String, dynamic>.from(raw as Map), ['status']).toLowerCase() == 'pending';
    }).length;
    final approved = rows.where((raw) {
      return pick(Map<String, dynamic>.from(raw as Map), ['status']).toLowerCase() == 'approved';
    }).length;

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: screenListPadding(context),
        children: [
          const PageHero(
            title: 'Leave',
            subtitle: 'Request time off and track approvals',
            trailing: Icon(Icons.beach_access_rounded, color: Colors.white, size: 36),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                MetricTile(label: 'Pending', value: '$pending', icon: Icons.hourglass_top_rounded, color: AppColors.warn),
                const SizedBox(width: 10),
                MetricTile(label: 'Approved', value: '$approved', icon: Icons.verified_outlined, color: AppColors.ok),
                const SizedBox(width: 10),
                MetricTile(label: 'Total', value: '${rows.length}', icon: Icons.folder_open_outlined),
              ],
            ),
          ),
          const SizedBox(height: 14),
          if (balances.isNotEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: SectionCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Leave balances', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
                    const SizedBox(height: 8),
                    ...balances.map((raw) {
                      final b = Map<String, dynamic>.from(raw as Map);
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 6),
                        child: Text(
                          '${pick(b, ['fullName', 'full_name'])} · ${pick(b, ['leaveType', 'leave_type'])}: '
                          '${pick(b, ['remainingDays', 'remaining_days'], '?')} remaining '
                          '(used ${pick(b, ['usedDays', 'used_days'], '0')} / ${pick(b, ['entitlementDays', 'entitlement_days'], '?')})',
                          style: TextStyle(color: T.muted(context), fontSize: 13),
                        ),
                      );
                    }),
                  ],
                ),
              ),
            ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: SectionCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Holiday calendar (UAE 2026)', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
                  const SizedBox(height: 8),
                  ...uaeHolidays2026.map((h) => Padding(
                        padding: const EdgeInsets.only(bottom: 4),
                        child: Text(
                          '${formatDate(h['date'])} · ${h['name']}',
                          style: TextStyle(color: T.muted(context), fontSize: 12.5),
                        ),
                      )),
                ],
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: SectionCard(
              child: FormSpacedColumn(
                children: [
                  Text('New request', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
                  if (error != null) Text(error!, style: const TextStyle(color: AppColors.danger)),
                  if (msg != null) Text(msg!, style: const TextStyle(color: AppColors.ok, fontWeight: FontWeight.w600)),
                  DropdownButtonFormField<String>(
                    initialValue: leaveType,
                    decoration: const InputDecoration(labelText: 'Type'),
                    items: const [
                      DropdownMenuItem(value: 'Annual', child: Text('Annual')),
                      DropdownMenuItem(value: 'Sick', child: Text('Sick')),
                      DropdownMenuItem(value: 'Maternity', child: Text('Maternity')),
                      DropdownMenuItem(value: 'Unpaid', child: Text('Unpaid')),
                    ],
                    onChanged: (v) => setState(() => leaveType = v ?? 'Annual'),
                  ),
                  Row(
                    children: [
                      Expanded(
                        child: TextFormField(
                          initialValue: startDate,
                          decoration: const InputDecoration(labelText: 'Start'),
                          onChanged: (v) => startDate = v,
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: TextFormField(
                          initialValue: endDate,
                          decoration: const InputDecoration(labelText: 'End'),
                          onChanged: (v) => endDate = v,
                        ),
                      ),
                    ],
                  ),
                  TextFormField(
                    initialValue: days,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'Days'),
                    onChanged: (v) => days = v,
                  ),
                  TextFormField(
                    decoration: const InputDecoration(labelText: 'Reason'),
                    onChanged: (v) => reason = v,
                  ),
                  FilledButton.icon(
                    onPressed: submitting ? null : _submit,
                    icon: submitting
                        ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                        : const Icon(Icons.send_rounded),
                    label: Text(submitting ? 'Submitting…' : 'Submit request'),
                  ),
                ],
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 6, 20, 8),
            child: Text('My requests', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
          ),
          if (loading) const ScreenLoader(),
          if (!loading && rows.isEmpty) const EmptyHint('No leave requests yet.', icon: Icons.beach_access_outlined),
          ...rows.map((raw) {
            final r = Map<String, dynamic>.from(raw as Map);
            return Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: SectionCard(
                child: Row(
                  children: [
                    Container(
                      width: 48,
                      height: 48,
                      decoration: BoxDecoration(
                        color: AppColors.accent.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: const Icon(Icons.event_available_rounded, color: AppColors.accent),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(pick(r, ['leaveType', 'leave_type']), style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
                          const SizedBox(height: 4),
                          Text(
                            '${formatDate(r['startDate'] ?? r['start_date'])} → ${formatDate(r['endDate'] ?? r['end_date'])} · ${pick(r, ['days'])} days',
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                        ],
                      ),
                    ),
                    StatusChip(pick(r, ['workflowStage', 'workflow_stage'], pick(r, ['status']))),
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
