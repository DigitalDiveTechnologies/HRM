import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/api_client.dart';
import '../state/app_state.dart';
import '../theme/app_theme.dart';
import '../utils/format.dart';
import '../widgets/ui_kit.dart';

class ExpensesScreen extends StatefulWidget {
  const ExpensesScreen({super.key});

  @override
  State<ExpensesScreen> createState() => _ExpensesScreenState();
}

class _ExpensesScreenState extends State<ExpensesScreen> {
  List<dynamic> claims = [];
  bool loading = true;
  String? error;
  String filterStatus = 'all';

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
    final myId = user?.employeeId;
    final role = (user?.role ?? '').toLowerCase();

    try {
      List<dynamic> list;
      try {
        final res = await api.request('/travel/expenses');
        list = res as List<dynamic>;
      } on ApiException catch (e) {
        if (e.statusCode == 404) {
          final res = await api.request('/expenses');
          list = res as List<dynamic>;
        } else {
          rethrow;
        }
      }

      final mine = (role == 'employee' && myId != null)
          ? list.where((raw) {
              final r = Map<String, dynamic>.from(raw as Map);
              final id = r['employeeId'] ?? r['employee_id'];
              return id == null || id.toString() == myId.toString();
            }).toList()
          : list;

      if (!mounted) return;
      setState(() {
        claims = mine;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => error = e.message);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  void _openSubmitDialog() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => _SubmitExpenseSheet(
        onSubmitted: () {
          _load();
        },
      ),
    );
  }

  void _showReceiptInfo(String fileName, String? fileRef) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Row(
          children: [
            Icon(Icons.receipt_rounded, color: AppColors.accent),
            SizedBox(width: 8),
            Text('Receipt Attachment'),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('File Name: $fileName', style: const TextStyle(fontWeight: FontWeight.w700)),
            const SizedBox(height: 6),
            if (fileRef != null && fileRef.isNotEmpty) ...[
              Text(
                'Stored at: $fileRef',
                style: TextStyle(color: T.muted(ctx), fontSize: 12),
              ),
              const SizedBox(height: 10),
            ],
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: AppColors.ok.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.verified_rounded, size: 16, color: AppColors.ok),
                  SizedBox(width: 6),
                  Text(
                    'Stored & Verified on Server',
                    style: TextStyle(color: AppColors.ok, fontWeight: FontWeight.w700, fontSize: 12),
                  ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    int pendingCount = 0;
    int approvedCount = 0;
    double reimbursedTotal = 0;

    for (final raw in claims) {
      final c = Map<String, dynamic>.from(raw as Map);
      final st = (c['status'] ?? '').toString().toLowerCase();
      final amt = num.tryParse((c['amount'] ?? 0).toString())?.toDouble() ?? 0.0;
      if (st == 'pending') {
        pendingCount++;
      } else if (st == 'approved') {
        approvedCount++;
      } else if (st == 'paid' || st == 'reimbursed') {
        reimbursedTotal += amt;
      }
    }

    final filtered = claims.where((raw) {
      if (filterStatus == 'all') return true;
      final c = Map<String, dynamic>.from(raw as Map);
      final st = (c['status'] ?? '').toString().toLowerCase();
      if (filterStatus == 'reimbursed') {
        return st == 'paid' || st == 'reimbursed';
      }
      return st == filterStatus;
    }).toList();

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: screenListPadding(context),
        children: [
          const PageHero(
            title: 'Expense Claims',
            subtitle: 'Submit out-of-pocket expenses and attach receipts',
            trailing: Icon(Icons.receipt_long_rounded, color: Colors.white, size: 36),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                MetricTile(
                  label: 'Pending',
                  value: '$pendingCount',
                  icon: Icons.hourglass_top_rounded,
                  color: AppColors.warn,
                ),
                const SizedBox(width: 10),
                MetricTile(
                  label: 'Approved',
                  value: '$approvedCount',
                  icon: Icons.check_circle_outline,
                  color: AppColors.ok,
                ),
                const SizedBox(width: 10),
                MetricTile(
                  label: 'Reimbursed',
                  value: money(reimbursedTotal),
                  icon: Icons.payments_outlined,
                  color: AppColors.accent,
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),

          // Primary Action Button
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: FilledButton.icon(
              onPressed: _openSubmitDialog,
              icon: const Icon(Icons.add_circle_outline_rounded, size: 20),
              label: const Text('Submit New Expense Claim'),
              style: FilledButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 12),
                backgroundColor: AppColors.accent,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
          ),
          const SizedBox(height: 14),

          // Filter chips
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                _filterChip('all', 'All (${claims.length})'),
                const SizedBox(width: 8),
                _filterChip('pending', 'Pending ($pendingCount)'),
                const SizedBox(width: 8),
                _filterChip('approved', 'Approved ($approvedCount)'),
                const SizedBox(width: 8),
                _filterChip('reimbursed', 'Reimbursed'),
                const SizedBox(width: 8),
                _filterChip('rejected', 'Rejected'),
              ],
            ),
          ),
          const SizedBox(height: 12),

          if (error != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Text(error!, style: const TextStyle(color: AppColors.danger)),
            ),

          if (loading) const ScreenLoader(),

          if (!loading && filtered.isEmpty)
            const EmptyHint('No expense claims found.', icon: Icons.receipt_long_outlined),

          if (!loading)
            ...filtered.map((raw) {
              final c = Map<String, dynamic>.from(raw as Map);
              final category = pick(c, ['category', 'claimType', 'claim_type'], 'General Expense');
              final title = pick(c, ['title', 'description', 'notes'], category);
              final rawStatus = pick(c, ['status'], 'pending');
              final statusLower = rawStatus.toLowerCase();
              final displayStatus = (statusLower == 'paid' || statusLower == 'reimbursed')
                  ? 'Reimbursed'
                  : rawStatus;
              final amountNum = num.tryParse((c['amount'] ?? 0).toString()) ?? 0;
              final currency = pick(c, ['currency'], 'AED');
              final dateStr = pick(c, ['expenseDate', 'expense_date', 'date', 'created_at']);
              final fileRef = (c['receiptFileRef'] ?? c['receipt_file_ref'] ?? c['receiptUrl'] ?? c['receipt_url'])?.toString();
              final hasReceipt = fileRef != null && fileRef.isNotEmpty;
              final receiptName = pick(c, ['receiptFileName', 'receipt_file_name'], 'receipt_attachment');

              return Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: SectionCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            width: 44,
                            height: 44,
                            decoration: BoxDecoration(
                              color: _categoryColor(category).withValues(alpha: 0.14),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Icon(_categoryIcon(category), color: _categoryColor(category), size: 22),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Expanded(
                                      child: Text(
                                        title,
                                        style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15),
                                        maxLines: 2,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    StatusChip(displayStatus),
                                  ],
                                ),
                                const SizedBox(height: 3),
                                Wrap(
                                  spacing: 8,
                                  runSpacing: 4,
                                  children: [
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                      decoration: BoxDecoration(
                                        color: T.muted(context).withValues(alpha: 0.12),
                                        borderRadius: BorderRadius.circular(6),
                                      ),
                                      child: Text(
                                        category,
                                        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: T.muted(context)),
                                      ),
                                    ),
                                    Text(
                                      formatDate(dateStr),
                                      style: TextStyle(color: T.muted(context), fontSize: 12),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      const Divider(height: 1),
                      const SizedBox(height: 10),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Amount',
                                style: TextStyle(color: T.muted(context), fontSize: 11, fontWeight: FontWeight.w600),
                              ),
                              Text(
                                '$currency ${money(amountNum)}',
                                style: TextStyle(
                                  color: T.ink(context),
                                  fontWeight: FontWeight.w900,
                                  fontSize: 17,
                                ),
                              ),
                            ],
                          ),
                          if (hasReceipt)
                            InkWell(
                              onTap: () => _showReceiptInfo(receiptName, fileRef),
                              borderRadius: BorderRadius.circular(8),
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                decoration: BoxDecoration(
                                  color: AppColors.accent.withValues(alpha: 0.12),
                                  borderRadius: BorderRadius.circular(8),
                                  border: Border.all(color: AppColors.accent.withValues(alpha: 0.3)),
                                ),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    const Icon(Icons.attach_file_rounded, size: 15, color: AppColors.accent),
                                    const SizedBox(width: 4),
                                    ConstrainedBox(
                                      constraints: const BoxConstraints(maxWidth: 130),
                                      child: Text(
                                        receiptName,
                                        style: const TextStyle(
                                          color: AppColors.accent,
                                          fontSize: 11.5,
                                          fontWeight: FontWeight.w700,
                                        ),
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            )
                          else
                            Text(
                              'No receipt attached',
                              style: TextStyle(color: T.muted(context), fontSize: 11, fontStyle: FontStyle.italic),
                            ),
                        ],
                      ),
                      if (c['notes'] != null && c['notes'].toString().trim().isNotEmpty && c['notes'] != title) ...[
                        const SizedBox(height: 8),
                        Text(
                          c['notes'].toString().trim(),
                          style: TextStyle(color: T.muted(context), fontSize: 12.5),
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

  Widget _filterChip(String id, String label) {
    final active = filterStatus == id;
    return ChoiceChip(
      label: Text(label),
      selected: active,
      onSelected: (_) => setState(() => filterStatus = id),
      labelStyle: TextStyle(
        color: active ? Colors.white : T.ink(context),
        fontSize: 12.5,
        fontWeight: active ? FontWeight.w700 : FontWeight.w500,
      ),
      selectedColor: AppColors.accent,
      backgroundColor: T.surface(context),
      side: BorderSide(
        color: active ? AppColors.accent : T.cardBorder(context),
      ),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
    );
  }

  Color _categoryColor(String category) {
    final cat = category.toLowerCase();
    if (cat.contains('travel') || cat.contains('taxi') || cat.contains('flight')) {
      return const Color(0xFF0284C7);
    } else if (cat.contains('meal') || cat.contains('client') || cat.contains('food')) {
      return const Color(0xFFF59E0B);
    } else if (cat.contains('suppl') || cat.contains('office') || cat.contains('equip')) {
      return const Color(0xFF8B5CF6);
    } else if (cat.contains('medic') || cat.contains('health')) {
      return const Color(0xFFEF4444);
    } else if (cat.contains('train') || cat.contains('course') || cat.contains('cert')) {
      return const Color(0xFF10B981);
    }
    return AppColors.accent;
  }

  IconData _categoryIcon(String category) {
    final cat = category.toLowerCase();
    if (cat.contains('travel') || cat.contains('taxi') || cat.contains('flight')) {
      return Icons.flight_takeoff_rounded;
    } else if (cat.contains('meal') || cat.contains('client') || cat.contains('food')) {
      return Icons.restaurant_rounded;
    } else if (cat.contains('suppl') || cat.contains('office') || cat.contains('equip')) {
      return Icons.business_center_rounded;
    } else if (cat.contains('medic') || cat.contains('health')) {
      return Icons.medical_services_rounded;
    } else if (cat.contains('train') || cat.contains('course') || cat.contains('cert')) {
      return Icons.school_rounded;
    }
    return Icons.receipt_long_rounded;
  }
}

class _SubmitExpenseSheet extends StatefulWidget {
  const _SubmitExpenseSheet({required this.onSubmitted});
  final VoidCallback onSubmitted;

  @override
  State<_SubmitExpenseSheet> createState() => _SubmitExpenseSheetState();
}

class _SubmitExpenseSheetState extends State<_SubmitExpenseSheet> {
  final _formKey = GlobalKey<FormState>();
  String category = 'Travel';
  final _titleCtrl = TextEditingController();
  final _amountCtrl = TextEditingController();
  final _notesCtrl = TextEditingController();
  String expenseDate = todayIso();

  PlatformFile? attachedFile;
  List<int>? fileBytes;
  bool uploading = false;
  String? error;

  final categories = const [
    'Travel',
    'Client Meals',
    'Office Supplies',
    'Medical',
    'Training',
  ];

  @override
  void dispose() {
    _titleCtrl.dispose();
    _amountCtrl.dispose();
    _notesCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickReceipt() async {
    try {
      final file = await FilePicker.pickFile(
        type: FileType.custom,
        allowedExtensions: const ['pdf', 'png', 'jpg', 'jpeg', 'webp'],
      );

      if (file != null) {
        final bytes = await file.readAsBytes();
        setState(() {
          attachedFile = file;
          fileBytes = bytes;
          error = null;
        });
      }
    } catch (e) {
      setState(() => error = 'Could not select receipt: $e');
    }
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    final appState = context.read<AppState>();
    final user = appState.user;
    final empId = user?.employeeId ?? user?.id;
    if (empId == null) {
      setState(() => error = 'No employee profile linked to account.');
      return;
    }

    setState(() {
      uploading = true;
      error = null;
    });

    final api = appState.api;
    String? receiptRef;
    String? receiptName;

    try {
      // Step 1: Upload receipt if attached
      if (attachedFile != null && fileBytes != null) {
        try {
          final res = await api.uploadMultipart(
            '/travel/expenses/upload-receipt',
            fields: {},
            fileField: 'file',
            fileName: attachedFile!.name,
            bytes: fileBytes!,
          );
          if (res is Map) {
            receiptRef = res['fileRef']?.toString();
            receiptName = res['fileName']?.toString() ?? attachedFile!.name;
          }
        } on ApiException catch (e) {
          if (e.statusCode == 404) {
            try {
              final res = await api.uploadMultipart(
                '/expenses/upload-receipt',
                fields: {},
                fileField: 'file',
                fileName: attachedFile!.name,
                bytes: fileBytes!,
              );
              if (res is Map) {
                receiptRef = res['fileRef']?.toString();
                receiptName = res['fileName']?.toString() ?? attachedFile!.name;
              }
            } catch (err) {
              setState(() => error = 'Receipt upload failed: $err');
              uploading = false;
              return;
            }
          } else {
            setState(() => error = 'Receipt upload failed: ${e.message}');
            uploading = false;
            return;
          }
        } catch (e) {
          setState(() => error = 'Receipt upload failed: $e');
          uploading = false;
          return;
        }
      }

      // Step 2: Post claim
      final amount = double.tryParse(_amountCtrl.text.trim()) ?? 0.0;
      final title = _titleCtrl.text.trim().isNotEmpty ? _titleCtrl.text.trim() : '$category claim';
      final notes = _notesCtrl.text.trim();

      final body = <String, dynamic>{
        'employeeId': empId,
        'title': title,
        'category': category,
        'claimType': category,
        'amount': amount,
        'currency': 'AED',
        'expenseDate': expenseDate,
        'notes': notes.isNotEmpty ? notes : title,
        'description': notes.isNotEmpty ? notes : title,
      };
      if (receiptRef != null) body['receiptFileRef'] = receiptRef;
      if (receiptName != null) body['receiptFileName'] = receiptName;

      try {
        await api.request(
          '/travel/expenses',
          method: 'POST',
          body: body,
        );
      } on ApiException catch (e) {
        if (e.statusCode == 404) {
          await api.request(
            '/expenses',
            method: 'POST',
            body: body,
          );
        } else {
          rethrow;
        }
      }

      if (!mounted) return;
      Navigator.of(context).pop();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Expense claim submitted successfully.'),
          backgroundColor: AppColors.ok,
        ),
      );
      widget.onSubmitted();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => error = e.message);
    } catch (e) {
      if (!mounted) return;
      setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => uploading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.viewInsetsOf(context).bottom;

    return SafeArea(
      child: Container(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.sizeOf(context).height * 0.88,
        ),
        decoration: BoxDecoration(
          color: T.surface(context),
          borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        ),
        padding: EdgeInsets.fromLTRB(20, 16, 20, 20 + bottomInset),
        child: SingleChildScrollView(
          child: Form(
            key: _formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Center(
                  child: Container(
                    width: 44,
                    height: 4,
                    margin: const EdgeInsets.only(bottom: 16),
                    decoration: BoxDecoration(
                      color: T.muted(context).withValues(alpha: 0.3),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Submit Expense Claim',
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
                    ),
                    IconButton(
                      onPressed: () => Navigator.of(context).pop(),
                      icon: const Icon(Icons.close),
                    ),
                  ],
                ),
                const SizedBox(height: 12),

                if (error != null) ...[
                  Container(
                    padding: const EdgeInsets.all(10),
                    margin: const EdgeInsets.only(bottom: 12),
                    decoration: BoxDecoration(
                      color: AppColors.danger.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: AppColors.danger.withValues(alpha: 0.3)),
                    ),
                    child: Text(error!, style: const TextStyle(color: AppColors.danger, fontSize: 13)),
                  ),
                ],

                // Category dropdown
                DropdownButtonFormField<String>(
                  initialValue: category,
                  decoration: const InputDecoration(
                    labelText: 'Category',
                    prefixIcon: Icon(Icons.category_outlined),
                  ),
                  items: categories
                      .map((c) => DropdownMenuItem(value: c, child: Text(c)))
                      .toList(),
                  onChanged: (v) => setState(() => category = v ?? 'Travel'),
                ),
                const SizedBox(height: 12),

                // Title / Purpose
                TextFormField(
                  controller: _titleCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Purpose / Title',
                    hintText: 'e.g. Taxi to client DIFC meeting',
                    prefixIcon: Icon(Icons.description_outlined),
                  ),
                  validator: (v) {
                    if (v == null || v.trim().isEmpty) return 'Please enter purpose';
                    return null;
                  },
                ),
                const SizedBox(height: 12),

                // Amount & Date row
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: TextFormField(
                        controller: _amountCtrl,
                        keyboardType: const TextInputType.numberWithOptions(decimal: true),
                        decoration: const InputDecoration(
                          labelText: 'Amount',
                          prefixText: 'AED ',
                          prefixIcon: Icon(Icons.payments_outlined),
                        ),
                        validator: (v) {
                          if (v == null || v.trim().isEmpty) return 'Required';
                          final n = double.tryParse(v.trim());
                          if (n == null || n <= 0) return 'Must be > 0';
                          return null;
                        },
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: InkWell(
                        onTap: () async {
                          final picked = await showDatePicker(
                            context: context,
                            initialDate: DateTime.tryParse(expenseDate) ?? DateTime.now(),
                            firstDate: DateTime.now().subtract(const Duration(days: 365)),
                            lastDate: DateTime.now().add(const Duration(days: 30)),
                          );
                          if (picked != null) {
                            setState(() {
                              expenseDate = '${picked.year.toString().padLeft(4, '0')}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}';
                            });
                          }
                        },
                        child: InputDecorator(
                          decoration: const InputDecoration(
                            labelText: 'Expense Date',
                            prefixIcon: Icon(Icons.calendar_today_outlined),
                          ),
                          child: Text(formatDate(expenseDate), style: const TextStyle(fontSize: 13.5)),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),

                // Description notes
                TextFormField(
                  controller: _notesCtrl,
                  maxLines: 2,
                  decoration: const InputDecoration(
                    labelText: 'Notes / Justification (optional)',
                    hintText: 'Additional details about the expense...',
                    alignLabelWithHint: true,
                  ),
                ),
                const SizedBox(height: 16),

                // Receipt Attachment Box
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: T.surface(context),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: attachedFile != null ? AppColors.accent : T.cardBorder(context),
                      width: attachedFile != null ? 1.5 : 1.0,
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Row(
                            children: [
                              Icon(Icons.receipt_rounded, size: 20, color: AppColors.accent),
                              SizedBox(width: 8),
                              Text(
                                'Invoice Receipt',
                                style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5),
                              ),
                            ],
                          ),
                          OutlinedButton.icon(
                            onPressed: uploading ? null : _pickReceipt,
                            icon: const Icon(Icons.upload_file_rounded, size: 16),
                            label: Text(attachedFile == null ? 'Attach File' : 'Change'),
                            style: OutlinedButton.styleFrom(
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                              visualDensity: VisualDensity.compact,
                            ),
                          ),
                        ],
                      ),
                      if (attachedFile != null && fileBytes != null) ...[
                        const SizedBox(height: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                          decoration: BoxDecoration(
                            color: AppColors.accent.withValues(alpha: 0.08),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.attach_file_rounded, size: 18, color: AppColors.accent),
                              const SizedBox(width: 6),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      attachedFile!.name,
                                      style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12.5),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                    Text(
                                      '${(fileBytes!.length / 1024).toStringAsFixed(1)} KB',
                                      style: TextStyle(fontSize: 11, color: T.muted(context)),
                                    ),
                                  ],
                                ),
                              ),
                              IconButton(
                                icon: const Icon(Icons.clear, size: 18),
                                onPressed: () {
                                  setState(() {
                                    attachedFile = null;
                                    fileBytes = null;
                                  });
                                },
                                tooltip: 'Remove',
                              ),
                            ],
                          ),
                        ),
                      ] else ...[
                        const SizedBox(height: 4),
                        Text(
                          'Supports PDF, PNG, JPG, or WEBP (Max 20MB)',
                          style: TextStyle(fontSize: 11.5, color: T.muted(context)),
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 20),

                // Submit Button
                FilledButton.icon(
                  onPressed: uploading ? null : _submit,
                  icon: uploading
                      ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : const Icon(Icons.send_rounded),
                  label: Text(uploading ? 'Submitting Claim…' : 'Submit Claim'),
                  style: FilledButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
