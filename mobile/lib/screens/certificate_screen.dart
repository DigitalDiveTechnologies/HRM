import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/api_client.dart';
import '../state/app_state.dart';
import '../theme/app_theme.dart';
import '../utils/format.dart';
import '../widgets/ui_kit.dart';

const _typeLabels = {
  'bank': 'Bank Certificate',
  'salary': 'Salary Certificate',
  'noc_travel': 'NOC (Travel)',
};

class CertificateScreen extends StatefulWidget {
  const CertificateScreen({super.key});

  @override
  State<CertificateScreen> createState() => _CertificateScreenState();
}

class _CertificateScreenState extends State<CertificateScreen> {
  List<dynamic> rows = [];
  Map<String, dynamic>? prefill;
  bool loading = true;
  bool submitting = false;
  String? error;
  String? msg;
  String certType = 'salary';
  String purpose = '';
  String bankName = '';
  String travelDestination = '';

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
      final list = await api.request('/certificates') as List<dynamic>;
      final profile = await api.request('/certificates/prefill') as Map<String, dynamic>;
      if (!mounted) return;
      setState(() {
        rows = list;
        prefill = profile;
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
    if (certType == 'bank' && bankName.trim().isEmpty) {
      setState(() => error = 'Bank name is required.');
      return;
    }
    if (certType == 'noc_travel' && travelDestination.trim().isEmpty) {
      setState(() => error = 'Travel destination is required.');
      return;
    }

    setState(() {
      submitting = true;
      error = null;
      msg = null;
    });
    final api = context.read<AppState>().api;
    try {
      await api.request('/certificates', method: 'POST', body: {
        'employeeId': user.employeeId,
        'certificateType': certType,
        'purpose': purpose.trim().isEmpty ? null : purpose.trim(),
        'bankName': certType == 'bank' ? bankName.trim() : null,
        'travelDestination': certType == 'noc_travel' ? travelDestination.trim() : null,
      });
      if (!mounted) return;
      setState(() {
        msg = 'Certificate request submitted — HR will review shortly.';
        purpose = '';
        bankName = '';
        travelDestination = '';
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Certificate request submitted')),
      );
      await _load();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => error = e.message);
    } finally {
      if (mounted) setState(() => submitting = false);
    }
  }

  String _pick(Map<String, dynamic> m, List<String> keys, [String fallback = '—']) {
    for (final k in keys) {
      final v = m[k];
      if (v != null && v.toString().isNotEmpty) return v.toString();
    }
    return fallback;
  }

  @override
  Widget build(BuildContext context) {
    final p = prefill ?? {};

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: screenListPadding(context),
        children: [
          const PageHero(
            title: 'Certificates',
            subtitle: 'Request Bank, Salary, or NOC (Travel) certificates',
            trailing: Icon(Icons.description_outlined, color: Colors.white, size: 34),
          ),
          if (loading)
            const Padding(
              padding: EdgeInsets.all(24),
              child: Center(child: CircularProgressIndicator()),
            )
          else ...[
            if (error != null)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Text(error!, style: const TextStyle(color: AppColors.danger)),
              ),
            if (msg != null)
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                child: Text(msg!, style: TextStyle(color: AppColors.ok, fontWeight: FontWeight.w600)),
              ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: SectionCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Your profile (auto-filled)', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
                    const SizedBox(height: 8),
                    Text(_pick(p, ['fullName', 'full_name']), style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
                    const SizedBox(height: 6),
                    Text('ID: ${_pick(p, ['empCode', 'emp_code'])}'),
                    Text('Designation: ${_pick(p, ['designationName', 'designation_name', 'jobTitle', 'job_title'])}'),
                    Text('Department: ${_pick(p, ['departmentName', 'department_name'])}'),
                    Text('Division: ${_pick(p, ['divisionName', 'division_name'])}'),
                    Text('Basic salary: ${money(p['basicSalary'] ?? p['basic_salary'])}'),
                    Text('Join date: ${formatDate(p['joinDate'] ?? p['join_date'])}'),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: SectionCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text('New request', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String>(
                      value: certType,
                      decoration: const InputDecoration(labelText: 'Certificate type'),
                      items: _typeLabels.entries
                          .map((e) => DropdownMenuItem(value: e.key, child: Text(e.value)))
                          .toList(),
                      onChanged: submitting ? null : (v) => setState(() => certType = v ?? 'salary'),
                    ),
                    const SizedBox(height: 10),
                    TextField(
                      decoration: const InputDecoration(labelText: 'Purpose / comments (optional)'),
                      maxLines: 2,
                      onChanged: (v) => purpose = v,
                      enabled: !submitting,
                    ),
                    if (certType == 'bank') ...[
                      const SizedBox(height: 10),
                      TextField(
                        decoration: const InputDecoration(labelText: 'Bank name *'),
                        onChanged: (v) => bankName = v,
                        enabled: !submitting,
                      ),
                    ],
                    if (certType == 'noc_travel') ...[
                      const SizedBox(height: 10),
                      TextField(
                        decoration: const InputDecoration(labelText: 'Travel destination *'),
                        onChanged: (v) => travelDestination = v,
                        enabled: !submitting,
                      ),
                    ],
                    const SizedBox(height: 16),
                    FilledButton(
                      onPressed: submitting ? null : _submit,
                      child: submitting
                          ? const SizedBox(
                              height: 20,
                              width: 20,
                              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                            )
                          : const Text('Submit request'),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: SectionCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('My requests', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
                    const SizedBox(height: 8),
                    if (rows.isEmpty)
                      Text('No requests yet.', style: TextStyle(color: T.muted(context)))
                    else
                      Column(
                        children: rows.map((raw) {
                          final r = Map<String, dynamic>.from(raw as Map);
                          final type = (r['certificateType'] ?? r['certificate_type'] ?? '').toString();
                          final status = (r['status'] ?? 'pending').toString();
                          return ListTile(
                            contentPadding: EdgeInsets.zero,
                            title: Text(_typeLabels[type] ?? type),
                            subtitle: Text(formatDate(r['createdAt'] ?? r['created_at'])),
                            trailing: StatusChip(status),
                          );
                        }).toList(),
                      ),
                  ],
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
