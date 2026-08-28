import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../nav/app_nav.dart';
import '../services/api_client.dart';
import '../state/app_state.dart';
import '../theme/app_theme.dart';
import '../utils/format.dart';
import '../widgets/ui_kit.dart';

class TravelScreen extends StatefulWidget {
  const TravelScreen({super.key});

  @override
  State<TravelScreen> createState() => _TravelScreenState();
}

class _TravelScreenState extends State<TravelScreen> {
  List<dynamic> travel = [];
  List<dynamic> expenses = [];
  List<dynamic> employees = [];
  bool loading = true;
  String? error;
  String? msg;

  String tEmployeeId = '';
  String destination = '';
  String purpose = '';
  String startDate = todayIso();
  String endDate = todayIso();
  String estimatedCost = '0';

  String xEmployeeId = '';
  String xTitle = '';
  String xCategory = 'general';
  String xAmount = '';
  String xDate = todayIso();

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
      final t = await api.request('/travel/requests');
      final x = await api.request('/travel/expenses');
      final e = await api.request('/employees');
      if (!mounted) return;
      setState(() {
        travel = t as List<dynamic>;
        expenses = x as List<dynamic>;
        employees = e as List<dynamic>;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => error = e.message);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _createTravel() async {
    if (tEmployeeId.isEmpty || destination.trim().isEmpty) {
      setState(() => error = 'Employee and destination required.');
      return;
    }
    setState(() {
      error = null;
      msg = null;
    });
    try {
      await context.read<AppState>().api.request(
            '/travel/requests',
            method: 'POST',
            body: {
              'employeeId': int.parse(tEmployeeId),
              'destination': destination.trim(),
              'purpose': purpose.trim(),
              'startDate': startDate,
              'endDate': endDate,
              'estimatedCost': num.tryParse(estimatedCost) ?? 0,
              'currency': currencyCode(),
            },
          );
      setState(() {
        msg = 'Travel request created.';
        destination = '';
        purpose = '';
        tEmployeeId = '';
      });
      await _load();
    } on ApiException catch (e) {
      setState(() => error = e.message);
    }
  }

  Future<void> _createExpense() async {
    if (xEmployeeId.isEmpty || xTitle.trim().isEmpty || xAmount.isEmpty) {
      setState(() => error = 'Employee, title and amount required.');
      return;
    }
    setState(() {
      error = null;
      msg = null;
    });
    try {
      await context.read<AppState>().api.request(
            '/travel/expenses',
            method: 'POST',
            body: {
              'employeeId': int.parse(xEmployeeId),
              'title': xTitle.trim(),
              'category': xCategory,
              'amount': num.tryParse(xAmount) ?? 0,
              'expenseDate': xDate,
              'currency': currencyCode(),
            },
          );
      setState(() {
        msg = 'Expense claim created.';
        xTitle = '';
        xAmount = '';
        xEmployeeId = '';
      });
      await _load();
    } on ApiException catch (e) {
      setState(() => error = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isAdmin = normalizeRole(context.watch<AppState>().user?.role) == 'admin';

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: screenListPadding(context),
        children: [
          const PageHero(
            title: 'Travel & Expense',
            subtitle: 'Trips and expense claims',
            trailing: Icon(Icons.flight_takeoff_outlined, color: Colors.white, size: 34),
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
                    Text('New travel', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
                    DropdownButtonFormField<String>(
                      initialValue: tEmployeeId.isEmpty ? null : tEmployeeId,
                      decoration: const InputDecoration(labelText: 'Employee'),
                      items: employees
                          .map((raw) {
                            final e = Map<String, dynamic>.from(raw as Map);
                            return DropdownMenuItem(value: '${e['id']}', child: Text(pick(e, ['fullName', 'full_name'])));
                          })
                          .toList(),
                      onChanged: (v) => setState(() => tEmployeeId = v ?? ''),
                    ),
                    TextFormField(decoration: const InputDecoration(labelText: 'Destination'), onChanged: (v) => destination = v),
                    TextFormField(decoration: const InputDecoration(labelText: 'Purpose'), onChanged: (v) => purpose = v),
                    Row(
                      children: [
                        Expanded(child: TextFormField(initialValue: startDate, decoration: const InputDecoration(labelText: 'Start'), onChanged: (v) => startDate = v)),
                        const SizedBox(width: 8),
                        Expanded(child: TextFormField(initialValue: endDate, decoration: const InputDecoration(labelText: 'End'), onChanged: (v) => endDate = v)),
                      ],
                    ),
                    TextFormField(initialValue: estimatedCost, decoration: const InputDecoration(labelText: 'Estimated cost'), onChanged: (v) => estimatedCost = v),
                    FilledButton(onPressed: _createTravel, child: const Text('Create travel')),
                  ],
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: SectionCard(
                child: FormSpacedColumn(
                  children: [
                    Text('New expense', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
                    DropdownButtonFormField<String>(
                      initialValue: xEmployeeId.isEmpty ? null : xEmployeeId,
                      decoration: const InputDecoration(labelText: 'Employee'),
                      items: employees
                          .map((raw) {
                            final e = Map<String, dynamic>.from(raw as Map);
                            return DropdownMenuItem(value: '${e['id']}', child: Text(pick(e, ['fullName', 'full_name'])));
                          })
                          .toList(),
                      onChanged: (v) => setState(() => xEmployeeId = v ?? ''),
                    ),
                    TextFormField(decoration: const InputDecoration(labelText: 'Title'), onChanged: (v) => xTitle = v),
                    DropdownButtonFormField<String>(
                      initialValue: xCategory,
                      decoration: const InputDecoration(labelText: 'Category'),
                      items: const [
                        DropdownMenuItem(value: 'general', child: Text('General')),
                        DropdownMenuItem(value: 'travel', child: Text('Travel')),
                        DropdownMenuItem(value: 'meals', child: Text('Meals')),
                        DropdownMenuItem(value: 'other', child: Text('Other')),
                      ],
                      onChanged: (v) => setState(() => xCategory = v ?? 'general'),
                    ),
                    TextFormField(decoration: const InputDecoration(labelText: 'Amount'), onChanged: (v) => xAmount = v),
                    TextFormField(initialValue: xDate, decoration: const InputDecoration(labelText: 'Date'), onChanged: (v) => xDate = v),
                    FilledButton(onPressed: _createExpense, child: const Text('Create expense')),
                  ],
                ),
              ),
            ),
          ],
          if (loading) const ScreenLoader(),
          if (!loading) ...[
            const Padding(
              padding: EdgeInsets.fromLTRB(16, 8, 16, 8),
              child: Text('Travel', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
            ),
            if (travel.isEmpty) const EmptyHint('No travel requests.'),
            ...travel.map((raw) {
              final t = Map<String, dynamic>.from(raw as Map);
              return Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: SectionCard(
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(pick(t, ['destination']), style: const TextStyle(fontWeight: FontWeight.w800)),
                            Text(
                              '${pick(t, ['fullName', 'full_name'])} · ${formatDate(t['startDate'] ?? t['start_date'])} → ${formatDate(t['endDate'] ?? t['end_date'])}',
                              style: TextStyle(color: T.muted(context), fontSize: 12.5),
                            ),
                            Text(money(t['estimatedCost'] ?? t['estimated_cost']), style: TextStyle(color: T.muted(context), fontSize: 12)),
                          ],
                        ),
                      ),
                      StatusChip(pick(t, ['status'])),
                    ],
                  ),
                ),
              );
            }),
            const Padding(
              padding: EdgeInsets.fromLTRB(16, 16, 16, 8),
              child: Text('Expenses', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
            ),
            if (expenses.isEmpty) const EmptyHint('No expense claims.'),
            ...expenses.map((raw) {
              final x = Map<String, dynamic>.from(raw as Map);
              return Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: SectionCard(
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(pick(x, ['title']), style: const TextStyle(fontWeight: FontWeight.w800)),
                            Text(
                              '${pick(x, ['fullName', 'full_name'])} · ${pick(x, ['category'])}',
                              style: TextStyle(color: T.muted(context), fontSize: 12.5),
                            ),
                            Text(
                              '${money(x['amount'])} · ${formatDate(x['expenseDate'] ?? x['expense_date'])}',
                              style: TextStyle(color: T.muted(context), fontSize: 12),
                            ),
                          ],
                        ),
                      ),
                      StatusChip(pick(x, ['status'])),
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
