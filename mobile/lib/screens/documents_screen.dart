import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/api_client.dart';
import '../state/app_state.dart';
import '../theme/app_theme.dart';
import '../utils/format.dart';
import '../widgets/ui_kit.dart';

class DocumentsScreen extends StatefulWidget {
  const DocumentsScreen({super.key});

  @override
  State<DocumentsScreen> createState() => _DocumentsScreenState();
}

class _DocumentsScreenState extends State<DocumentsScreen> {
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
      final data = await api.request('/documents');
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
            title: 'Documents',
            subtitle: 'Contracts, passport, Emirates ID, visa',
            trailing: Icon(Icons.folder_rounded, color: Colors.white, size: 34),
          ),
          if (error != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Text(error!, style: const TextStyle(color: AppColors.danger)),
            ),
          if (loading) const Padding(padding: EdgeInsets.all(32), child: Center(child: CircularProgressIndicator())),
          if (!loading && rows.isEmpty) const EmptyHint('No documents found.'),
          ...rows.map((raw) {
            final d = Map<String, dynamic>.from(raw as Map);
            return Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: SectionCard(
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: AppColors.accent.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(Icons.description_outlined, color: AppColors.accent),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(pick(d, ['title']), style: const TextStyle(fontWeight: FontWeight.w800)),
                          Text(
                            '${pick(d, ['fullName', 'full_name'])} · ${pick(d, ['docType', 'doc_type'])}',
                            style: TextStyle(color: T.muted(context), fontSize: 12.5),
                          ),
                          Text(
                            'Exp ${formatDate(d['expiryDate'] ?? d['expiry_date'])}',
                            style: TextStyle(color: T.muted(context), fontSize: 12),
                          ),
                        ],
                      ),
                    ),
                    StatusChip(pick(d, ['status'], 'ok')),
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
