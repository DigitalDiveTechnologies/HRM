import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/api_client.dart';
import '../state/app_state.dart';
import '../theme/app_theme.dart';
import '../utils/format.dart';
import '../widgets/ui_kit.dart';

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
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
      final data = await context.read<AppState>().api.request('/onboarding');
      if (!mounted) return;
      setState(() => rows = data as List<dynamic>);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => error = e.message);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _markDone(dynamic id) async {
    try {
      await context.read<AppState>().api.request(
            '/onboarding/$id',
            method: 'PATCH',
            body: {'status': 'done'},
          );
      await _load();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => error = e.message);
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
            title: 'Onboarding',
            subtitle: 'Checklist, documents, assets, training, signatures',
            trailing: Icon(Icons.rocket_launch_outlined, color: Colors.white, size: 34),
          ),
          if (error != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Text(error!, style: const TextStyle(color: AppColors.danger)),
            ),
          if (loading) const ScreenLoader(),
          if (!loading && rows.isEmpty) const EmptyHint('No onboarding tasks.'),
          ...rows.map((raw) {
            final t = Map<String, dynamic>.from(raw as Map);
            final status = pick(t, ['status']).toLowerCase();
            final done = status == 'done';
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
                              Text(pick(t, ['title']), style: const TextStyle(fontWeight: FontWeight.w800)),
                              Text(
                                '${pick(t, ['fullName', 'full_name'])} · ${pick(t, ['category'], '-')}',
                                style: TextStyle(color: T.muted(context), fontSize: 12.5),
                              ),
                              Text(
                                'Due ${formatDate(t['dueDate'] ?? t['due_date'])}',
                                style: TextStyle(color: T.muted(context), fontSize: 12),
                              ),
                            ],
                          ),
                        ),
                        StatusChip(pick(t, ['status'])),
                      ],
                    ),
                    if (!done) ...[
                      const SizedBox(height: 10),
                      Align(
                        alignment: Alignment.centerRight,
                        child: FilledButton(
                          onPressed: () => _markDone(t['id']),
                          child: const Text('Mark done'),
                        ),
                      ),
                    ] else
                      Padding(
                        padding: const EdgeInsets.only(top: 8),
                        child: Text(
                          'Signed ${formatDate(t['signedAt'] ?? t['signed_at'])}',
                          style: TextStyle(color: T.muted(context), fontSize: 12),
                        ),
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
