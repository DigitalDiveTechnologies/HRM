import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../nav/app_nav.dart';
import '../services/api_client.dart';
import '../state/app_state.dart';
import '../theme/app_theme.dart';
import '../utils/format.dart';
import '../widgets/ui_kit.dart';

class AssetsScreen extends StatefulWidget {
  const AssetsScreen({super.key});

  @override
  State<AssetsScreen> createState() => _AssetsScreenState();
}

class _AssetsScreenState extends State<AssetsScreen> {
  List<dynamic> rows = [];
  List<dynamic> employees = [];
  bool loading = true;
  String? error;
  String? msg;

  String assetTag = '';
  String name = '';
  String category = 'laptop';
  String serialNo = '';
  String assignAssetId = '';
  String assignEmployeeId = '';

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
      final assets = await api.request('/assets');
      final emps = await api.request('/employees');
      if (!mounted) return;
      setState(() {
        rows = assets as List<dynamic>;
        employees = emps as List<dynamic>;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => error = e.message);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _create() async {
    setState(() {
      error = null;
      msg = null;
    });
    try {
      await context.read<AppState>().api.request(
            '/assets',
            method: 'POST',
            body: {
              'assetTag': assetTag.trim(),
              'name': name.trim(),
              'category': category,
              'serialNo': serialNo.trim().isEmpty ? null : serialNo.trim(),
            },
          );
      setState(() {
        msg = 'Asset created.';
        assetTag = '';
        name = '';
        serialNo = '';
      });
      await _load();
    } on ApiException catch (e) {
      setState(() => error = e.message);
    }
  }

  Future<void> _assign() async {
    if (assignAssetId.isEmpty || assignEmployeeId.isEmpty) {
      setState(() => error = 'Select asset and employee.');
      return;
    }
    setState(() {
      error = null;
      msg = null;
    });
    try {
      await context.read<AppState>().api.request(
            '/assets/$assignAssetId/assign',
            method: 'POST',
            body: {'employeeId': int.parse(assignEmployeeId)},
          );
      setState(() {
        msg = 'Asset assigned.';
        assignAssetId = '';
        assignEmployeeId = '';
      });
      await _load();
    } on ApiException catch (e) {
      setState(() => error = e.message);
    }
  }

  Future<void> _return(dynamic assignmentId) async {
    try {
      await context.read<AppState>().api.request(
            '/assets/assignments/$assignmentId/return',
            method: 'PATCH',
            body: {},
          );
      setState(() => msg = 'Asset returned.');
      await _load();
    } on ApiException catch (e) {
      setState(() => error = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isAdmin = normalizeRole(context.watch<AppState>().user?.role) == 'admin';
    final available = rows.where((raw) {
      final a = Map<String, dynamic>.from(raw as Map);
      return pick(a, ['status']).toLowerCase() == 'available';
    }).toList();

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: screenListPadding(context),
        children: [
          const PageHero(
            title: 'Assets',
            subtitle: 'Inventory and assignments',
            trailing: Icon(Icons.devices_other_outlined, color: Colors.white, size: 34),
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
          if (isAdmin) ...[
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: SectionCard(
                child: FormSpacedColumn(
                  children: [
                    Text('Add asset', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
                    TextFormField(decoration: const InputDecoration(labelText: 'Tag'), onChanged: (v) => assetTag = v),
                    TextFormField(decoration: const InputDecoration(labelText: 'Name'), onChanged: (v) => name = v),
                    DropdownButtonFormField<String>(
                      initialValue: category,
                      decoration: const InputDecoration(labelText: 'Category'),
                      items: const [
                        DropdownMenuItem(value: 'laptop', child: Text('Laptop')),
                        DropdownMenuItem(value: 'phone', child: Text('Phone')),
                        DropdownMenuItem(value: 'access_card', child: Text('Access card')),
                        DropdownMenuItem(value: 'other', child: Text('Other')),
                      ],
                      onChanged: (v) => setState(() => category = v ?? 'laptop'),
                    ),
                    TextFormField(decoration: const InputDecoration(labelText: 'Serial'), onChanged: (v) => serialNo = v),
                    FilledButton(onPressed: _create, child: const Text('Create asset')),
                  ],
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: SectionCard(
                child: FormSpacedColumn(
                  children: [
                    Text('Assign asset', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
                    DropdownButtonFormField<String>(
                      initialValue: assignAssetId.isEmpty ? null : assignAssetId,
                      decoration: const InputDecoration(labelText: 'Available asset'),
                      items: available.map((raw) {
                        final a = Map<String, dynamic>.from(raw as Map);
                        return DropdownMenuItem(
                          value: '${a['id']}',
                          child: Text('${pick(a, ['assetTag', 'asset_tag'])} · ${pick(a, ['name'])}'),
                        );
                      }).toList(),
                      onChanged: (v) => setState(() => assignAssetId = v ?? ''),
                    ),
                    DropdownButtonFormField<String>(
                      initialValue: assignEmployeeId.isEmpty ? null : assignEmployeeId,
                      decoration: const InputDecoration(labelText: 'Employee'),
                      items: employees.map((raw) {
                        final e = Map<String, dynamic>.from(raw as Map);
                        return DropdownMenuItem(
                          value: '${e['id']}',
                          child: Text(pick(e, ['fullName', 'full_name'])),
                        );
                      }).toList(),
                      onChanged: (v) => setState(() => assignEmployeeId = v ?? ''),
                    ),
                    FilledButton(onPressed: _assign, child: const Text('Assign')),
                  ],
                ),
              ),
            ),
          ],
          if (loading) const ScreenLoader(),
          if (!loading && rows.isEmpty) const EmptyHint('No assets yet.'),
          ...rows.map((raw) {
            final a = Map<String, dynamic>.from(raw as Map);
            final assigned = pick(a, ['assignedTo', 'assigned_to'], '');
            final assignmentId = a['assignmentId'] ?? a['assignment_id'];
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
                              Text(
                                '${pick(a, ['assetTag', 'asset_tag'])} · ${pick(a, ['name'])}',
                                style: const TextStyle(fontWeight: FontWeight.w800),
                              ),
                              Text(
                                pick(a, ['category']).replaceAll('_', ' '),
                                style: TextStyle(color: T.muted(context), fontSize: 12.5),
                              ),
                              if (assigned.isNotEmpty)
                                Text(
                                  'Assigned to $assigned',
                                  style: TextStyle(color: T.muted(context), fontSize: 12),
                                ),
                            ],
                          ),
                        ),
                        StatusChip(pick(a, ['status'])),
                      ],
                    ),
                    if (isAdmin && assignmentId != null) ...[
                      const SizedBox(height: 8),
                      Align(
                        alignment: Alignment.centerRight,
                        child: TextButton(
                          onPressed: () => _return(assignmentId),
                          child: const Text('Mark returned'),
                        ),
                      ),
                    ],
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
