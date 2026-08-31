import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/api_client.dart';
import '../state/app_state.dart';
import '../theme/app_theme.dart';
import '../utils/format.dart';
import '../widgets/ui_kit.dart';

/// Team lead — approve/reject direct reports' leave (Phase 5).
class TeamApprovalsScreen extends StatefulWidget {
  const TeamApprovalsScreen({super.key});

  @override
  State<TeamApprovalsScreen> createState() => _TeamApprovalsScreenState();
}

class _TeamApprovalsScreenState extends State<TeamApprovalsScreen> {
  List<dynamic> rows = [];
  bool loading = true;
  String? error;
  String? msg;
  final _notes = <int, String>{};
  final _busy = <int>{};

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
    try {
      final data = await context.read<AppState>().api.request('/leave/team/approvals');
      if (!mounted) return;
      setState(() => rows = data as List<dynamic>);
      await context.read<AppState>().refreshTeamLead();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => error = e.message);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _decide(int approvalId, String status) async {
    if (_busy.contains(approvalId)) return;
    setState(() {
      msg = null;
      error = null;
      _busy.add(approvalId);
    });
    try {
      await context.read<AppState>().api.request(
            '/leave/team/approvals/$approvalId',
            method: 'PATCH',
            body: {
              'status': status,
              'note': _notes[approvalId],
            },
          );
      if (!mounted) return;
      setState(() => msg = status == 'approved' ? 'Leave approved — sent to HR.' : 'Leave rejected.');
      await _load();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => error = e.message);
    } finally {
      if (mounted) setState(() => _busy.remove(approvalId));
    }
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: screenListPadding(context),
        children: [
          const PageHero(
            title: 'Team approvals',
            subtitle: 'Approve leave for your direct reports',
            trailing: Icon(Icons.groups_rounded, color: Colors.white, size: 34),
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
          if (!loading && rows.isEmpty)
            const EmptyHint('No pending leave requests from your team.', icon: Icons.check_circle_outline),
          ...rows.map((raw) {
            final r = Map<String, dynamic>.from(raw as Map);
            final id = int.tryParse('${r['id']}') ?? 0;
            return Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              child: SectionCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      pick(r, ['fullName', 'full_name'], 'Employee'),
                      style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${pick(r, ['leaveType', 'leave_type'])} · ${pick(r, ['days'])} days',
                      style: TextStyle(color: T.muted(context)),
                    ),
                    Text(
                      '${formatDate(r['startDate'] ?? r['start_date'])} → ${formatDate(r['endDate'] ?? r['end_date'])}',
                      style: TextStyle(color: T.muted(context), fontSize: 12.5),
                    ),
                    if (pick(r, ['reason'], '').isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 6),
                        child: Text('Reason: ${pick(r, ['reason'])}', style: const TextStyle(fontSize: 13)),
                      ),
                    const SizedBox(height: 10),
                    TextFormField(
                      decoration: const InputDecoration(
                        labelText: 'Manager note (coverage / contact)',
                        prefixIcon: Icon(Icons.note_alt_outlined),
                      ),
                      onChanged: (v) => _notes[id] = v,
                    ),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        Expanded(
                          child: FilledButton.icon(
                            onPressed: id == 0 || _busy.contains(id) ? null : () => _decide(id, 'approved'),
                            icon: const Icon(Icons.check_rounded),
                            label: Text(_busy.contains(id) ? '…' : 'Approve'),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: id == 0 || _busy.contains(id) ? null : () => _decide(id, 'rejected'),
                            icon: const Icon(Icons.close_rounded),
                            label: const Text('Reject'),
                          ),
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
