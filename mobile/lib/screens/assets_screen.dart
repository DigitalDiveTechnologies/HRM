import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

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
    try {
      final data = await context.read<AppState>().api.request('/assets');
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
            title: 'Assets',
            subtitle: 'Inventory and assignments',
            trailing: Icon(Icons.devices_other_outlined, color: Colors.white, size: 34),
          ),
          if (error != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Text(error!, style: const TextStyle(color: AppColors.danger)),
            ),
          if (loading) const Padding(padding: EdgeInsets.all(32), child: Center(child: CircularProgressIndicator())),
          if (!loading && rows.isEmpty) const EmptyHint('No assets yet.'),
          ...rows.map((raw) {
            final a = Map<String, dynamic>.from(raw as Map);
            final assigned = pick(a, ['assignedTo', 'assigned_to'], '');
            return Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: SectionCard(
                child: Row(
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
              ),
            );
          }),
        ],
      ),
    );
  }
}
