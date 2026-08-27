import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/api_client.dart';
import '../state/app_state.dart';
import '../theme/app_theme.dart';
import '../utils/format.dart';
import '../widgets/ui_kit.dart';

class ComplianceScreen extends StatefulWidget {
  const ComplianceScreen({super.key});

  @override
  State<ComplianceScreen> createState() => _ComplianceScreenState();
}

class _ComplianceScreenState extends State<ComplianceScreen> {
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
    final api = context.read<AppState>().api;
    try {
      final data = await api.request('/compliance');
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
            title: 'Compliance',
            subtitle: 'Visa, documents, labour law & audits',
            trailing: Icon(Icons.verified_user_outlined, color: Colors.white, size: 34),
          ),
          if (error != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Text(error!, style: const TextStyle(color: AppColors.danger)),
            ),
          if (loading) const Padding(padding: EdgeInsets.all(32), child: Center(child: CircularProgressIndicator())),
          if (!loading && rows.isEmpty) const EmptyHint('No compliance items yet.'),
          ...rows.map((raw) {
            final r = Map<String, dynamic>.from(raw as Map);
            final employee = pick(r, ['fullName', 'full_name'], 'Company-wide');
            final category = pick(r, ['category']).replaceAll('_', ' ');
            final notes = pick(r, ['notes'], '');
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
                              Text(pick(r, ['title']), style: const TextStyle(fontWeight: FontWeight.w800)),
                              Text(
                                '$employee · $category',
                                style: TextStyle(color: T.muted(context), fontSize: 12.5),
                              ),
                              Text(
                                'Due ${formatDate(r['dueDate'] ?? r['due_date'])}',
                                style: TextStyle(color: T.muted(context), fontSize: 12),
                              ),
                            ],
                          ),
                        ),
                        StatusChip(pick(r, ['status'])),
                      ],
                    ),
                    if (notes.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      Text(notes, style: TextStyle(color: T.muted(context), fontSize: 12.5)),
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
