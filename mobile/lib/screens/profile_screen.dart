import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../l10n/l10n.dart';
import '../state/app_state.dart';
import '../theme/app_theme.dart';
import '../utils/format.dart';
import '../widgets/ui_kit.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  bool loading = true;
  String? error;
  Map<String, dynamic>? profile;
  List<dynamic> documents = [];
  List<dynamic> divisions = [];
  bool isTeamLead = false;
  bool showPassword = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final app = context.read<AppState>();
    final id = app.user?.employeeId;
    if (id == null) {
      setState(() {
        loading = false;
        error = 'No employee profile linked.';
      });
      return;
    }
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final api = app.api;
      final ess = await api.request('/ess/$id') as Map<String, dynamic>;
      Map<String, dynamic> team = {};
      List<dynamic> divs = [];
      try {
        team = Map<String, dynamic>.from(await api.request('/leave/team/summary') as Map);
      } catch (_) {}
      try {
        final raw = await api.request('/divisions');
        if (raw is List) divs = raw;
      } catch (_) {}
      if (!mounted) return;
      setState(() {
        profile = Map<String, dynamic>.from((ess['profile'] as Map?) ?? {});
        documents = (ess['documents'] as List?) ?? [];
        divisions = divs;
        isTeamLead = team['isTeamLead'] == true || team['is_team_lead'] == true;
        loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        loading = false;
        error = e.toString().replaceFirst('ApiException: ', '').replaceFirst('Exception: ', '');
      });
    }
  }

  Map<String, dynamic> get _master {
    final raw = profile?['masterData'] ?? profile?['master_data'];
    if (raw is Map) return Map<String, dynamic>.from(raw);
    if (raw is String && raw.trim().isNotEmpty) {
      try {
        final parsed = jsonDecode(raw);
        if (parsed is Map) return Map<String, dynamic>.from(parsed);
      } catch (_) {}
    }
    return {};
  }

  String _p(List<String> keys, [String fallback = '—']) {
    if (profile == null) return fallback;
    return pick(profile!, keys, fallback);
  }

  String get _companyName {
    final md = _master;
    final fromProfile = _p(['divisionName', 'division_name', 'companyName', 'company_name'], '');
    final fromMd = (md['divisionName'] ?? md['companyName'] ?? '').toString();
    final name = fromProfile.isNotEmpty && fromProfile != '—' ? fromProfile : fromMd;
    final divId = _p(['divisionId', 'division_id'], '');
    for (final raw in divisions) {
      final d = Map<String, dynamic>.from(raw as Map);
      final id = pick(d, ['id']);
      final dName = pick(d, ['name']);
      if ((divId.isNotEmpty && id == divId) ||
          (name.isNotEmpty && dName.toLowerCase() == name.toLowerCase())) {
        return dName.isNotEmpty ? dName : name;
      }
    }
    return name.isNotEmpty ? name : '—';
  }

  String get _appPassword {
    final md = _master;
    final fromProfile = _p(['password'], '');
    if (fromProfile.isNotEmpty && fromProfile != '—') return fromProfile;
    final fromMd = (md['password'] ?? md['appPassword'] ?? '').toString();
    if (fromMd.isNotEmpty) return fromMd;
    return 'demo123';
  }

  String get _citizenAddress {
    final md = _master;
    final v = (md['homeCountryAddress'] ?? md['citizenIdAddress'] ?? '').toString();
    if (v.isNotEmpty) return v;
    return _p(['homeCountryAddress', 'home_country_address']);
  }

  String get _residentialAddress {
    final md = _master;
    final v = (md['addressInUae'] ?? md['residentialAddress'] ?? '').toString();
    if (v.isNotEmpty) return v;
    return _p(['addressInUae', 'address_in_uae', 'residentialAddress', 'residential_address']);
  }

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();
    final user = app.user!;
    final l10n = L10n(app.locale);
    final name = _p(['fullName', 'full_name'], user.fullName ?? 'Employee');
    final empCode = _p(['empCode', 'emp_code'], user.employeeId?.toString() ?? '—');
    final status = _p(['status'], 'active');
    final job = _p(['jobTitle', 'job_title'], user.jobTitle ?? 'Employee');
    final dept = _p(['departmentName', 'department_name'], '—');
    final email = _p(['email'], user.email);
    final phone = _p(['phone'], '—');
    final join = formatDate(profile?['joinDate'] ?? profile?['join_date']);

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: screenListPadding(context),
        children: [
          PageHero(
            title: l10n.t('profile_title'),
            subtitle: l10n.t('profile_subtitle'),
            trailing: const Icon(Icons.person_rounded, color: Colors.white, size: 34),
          ),
          if (loading)
            const Padding(padding: EdgeInsets.all(40), child: ScreenLoader())
          else if (error != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Text(error!, style: const TextStyle(color: AppColors.danger)),
            )
          else ...[
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: SectionCard(
                child: Column(
                  children: [
                    InitialsAvatar(name, size: 72),
                    const SizedBox(height: 12),
                    Text(name, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 20)),
                    const SizedBox(height: 6),
                    Wrap(
                      spacing: 8,
                      runSpacing: 6,
                      alignment: WrapAlignment.center,
                      children: [
                        StatusChip(empCode),
                        StatusChip(status),
                        if (isTeamLead) StatusChip('Team Lead'),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text('$job · $dept', style: TextStyle(color: T.muted(context), fontSize: 13)),
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
                    Text('Job & company', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
                    const SizedBox(height: 8),
                    _row(context, 'Company', _companyName),
                    _row(context, 'Department', dept),
                    _row(context, 'Designation', job),
                    _row(context, 'Joining date', join),
                    _row(context, 'Status', status),
                    _row(context, 'Employee code', empCode),
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
                    Text('Account & contact', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
                    const SizedBox(height: 8),
                    _row(context, 'Email', email),
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      child: Row(
                        children: [
                          Expanded(child: Text('App password', style: TextStyle(color: T.muted(context)))),
                          Text(
                            showPassword ? _appPassword : '••••••••',
                            style: const TextStyle(fontWeight: FontWeight.w700),
                          ),
                          IconButton(
                            visualDensity: VisualDensity.compact,
                            onPressed: () => setState(() => showPassword = !showPassword),
                            icon: Icon(showPassword ? Icons.visibility_off_outlined : Icons.visibility_outlined, size: 18),
                          ),
                        ],
                      ),
                    ),
                    _row(context, 'Phone', phone),
                    _row(context, 'Citizen ID address', _citizenAddress),
                    _row(context, 'Residential address', _residentialAddress),
                    const SizedBox(height: 4),
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: Text(l10n.t('language')),
                      subtitle: Text(app.locale == 'ar' ? l10n.t('arabic') : l10n.t('english')),
                      trailing: FilledButton.tonal(
                        onPressed: () => app.toggleLocale(),
                        child: Text(app.locale == 'ar' ? 'EN' : 'ع'),
                      ),
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
                    Text('Uploaded documents', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
                    const SizedBox(height: 8),
                    if (documents.isEmpty)
                      Text('No documents uploaded for this profile.', style: TextStyle(color: T.muted(context)))
                    else
                      ...documents.map((raw) {
                        final d = Map<String, dynamic>.from(raw as Map);
                        final title = pick(d, ['title'], 'Document');
                        final type = pick(d, ['docType', 'doc_type'], 'Document');
                        final issue = formatDate(d['issueDate'] ?? d['issue_date']);
                        final expiry = formatDate(d['expiryDate'] ?? d['expiry_date']);
                        final st = pick(d, ['status'], 'valid');
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 10),
                          child: Container(
                            width: double.infinity,
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              border: Border.all(color: AppColors.accent.withValues(alpha: 0.2)),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
                                const SizedBox(height: 4),
                                Text('$type · $st', style: TextStyle(color: T.muted(context), fontSize: 12.5)),
                                Text('Issue $issue · Expiry $expiry', style: TextStyle(color: T.muted(context), fontSize: 12)),
                              ],
                            ),
                          ),
                        );
                      }),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: FilledButton.icon(
                onPressed: () => app.logout(),
                icon: const Icon(Icons.logout_rounded),
                label: Text(l10n.t('logout')),
              ),
            ),
            const SizedBox(height: 16),
          ],
        ],
      ),
    );
  }

  Widget _row(BuildContext context, String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(child: Text(label, style: TextStyle(color: T.muted(context)))),
          Expanded(
            child: Text(
              value,
              textAlign: TextAlign.end,
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
          ),
        ],
      ),
    );
  }
}
