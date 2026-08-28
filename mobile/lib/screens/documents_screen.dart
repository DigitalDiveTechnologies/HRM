import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../nav/app_nav.dart';
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
  List<dynamic> employees = [];
  bool loading = true;
  String? error;
  String? msg;
  bool uploading = false;

  String employeeId = '';
  String docType = 'passport';
  String title = '';
  String issueDate = todayIso();
  String expiryDate = '';
  PlatformFile? picked;

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
    final role = normalizeRole(context.read<AppState>().user?.role);
    try {
      final docs = await api.request('/documents');
      List<dynamic> emps = const [];
      if (role == 'admin') {
        emps = await api.request('/employees') as List<dynamic>;
      }
      if (!mounted) return;
      setState(() {
        rows = docs as List<dynamic>;
        employees = emps;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => error = e.message);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _pickFile() async {
    final file = await FilePicker.pickFile(
      type: FileType.custom,
      allowedExtensions: const ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'doc', 'docx', 'xls', 'xlsx', 'txt'],
    );
    if (file == null) return;
    setState(() => picked = file);
  }

  Future<void> _upload() async {
    if (employeeId.isEmpty || title.trim().isEmpty || picked == null) {
      setState(() => error = 'Employee, title and file are required.');
      return;
    }
    setState(() {
      uploading = true;
      error = null;
      msg = null;
    });
    try {
      final bytes = await picked!.readAsBytes();
      if (!mounted) return;
      final fields = <String, String>{
        'employeeId': employeeId,
        'docType': docType,
        'title': title.trim(),
        if (issueDate.isNotEmpty) 'issueDate': issueDate,
        if (expiryDate.isNotEmpty) 'expiryDate': expiryDate,
      };
      await context.read<AppState>().api.uploadMultipart(
            '/documents/upload',
            fields: fields,
            fileField: 'file',
            fileName: picked!.name,
            bytes: bytes,
          );
      setState(() {
        msg = 'Document uploaded.';
        title = '';
        expiryDate = '';
        employeeId = '';
        picked = null;
      });
      await _load();
    } on ApiException catch (e) {
      setState(() => error = e.message);
    } finally {
      if (mounted) setState(() => uploading = false);
    }
  }

  Future<void> _download(Map<String, dynamic> d) async {
    final id = d['id'];
    if (id == null) return;
    try {
      final bytes = await context.read<AppState>().api.downloadBytes('/documents/$id/file');
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Downloaded ${bytes.length} bytes · ${pick(d, ['title'])}')),
      );
      if (kIsWeb) {
        // Browser download handled via bytes confirmation; portal remains primary for save-as.
      }
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => error = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final admin = normalizeRole(context.watch<AppState>().user?.role) == 'admin';

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: screenListPadding(context),
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
          if (msg != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Text(msg!, style: const TextStyle(color: AppColors.ok, fontWeight: FontWeight.w600)),
            ),
          if (admin)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: SectionCard(
                child: FormSpacedColumn(
                  children: [
                    Text('Upload document', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
                    DropdownButtonFormField<String>(
                      initialValue: employeeId.isEmpty ? null : employeeId,
                      decoration: const InputDecoration(labelText: 'Employee'),
                      items: employees.map((raw) {
                        final e = Map<String, dynamic>.from(raw as Map);
                        return DropdownMenuItem(
                          value: '${e['id']}',
                          child: Text(pick(e, ['fullName', 'full_name'])),
                        );
                      }).toList(),
                      onChanged: (v) => setState(() => employeeId = v ?? ''),
                    ),
                    DropdownButtonFormField<String>(
                      initialValue: docType,
                      decoration: const InputDecoration(labelText: 'Type'),
                      items: const [
                        DropdownMenuItem(value: 'passport', child: Text('Passport')),
                        DropdownMenuItem(value: 'emirates_id', child: Text('Emirates ID')),
                        DropdownMenuItem(value: 'visa', child: Text('Visa')),
                        DropdownMenuItem(value: 'contract', child: Text('Contract')),
                        DropdownMenuItem(value: 'other', child: Text('Other')),
                      ],
                      onChanged: (v) => setState(() => docType = v ?? 'passport'),
                    ),
                    TextFormField(
                      decoration: const InputDecoration(labelText: 'Title'),
                      onChanged: (v) => title = v,
                    ),
                    Row(
                      children: [
                        Expanded(
                          child: TextFormField(
                            initialValue: issueDate,
                            decoration: const InputDecoration(labelText: 'Issue'),
                            onChanged: (v) => issueDate = v,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: TextFormField(
                            initialValue: expiryDate,
                            decoration: const InputDecoration(labelText: 'Expiry'),
                            onChanged: (v) => expiryDate = v,
                          ),
                        ),
                      ],
                    ),
                    OutlinedButton.icon(
                      onPressed: _pickFile,
                      icon: const Icon(Icons.attach_file),
                      label: Text(picked == null ? 'Choose file' : picked!.name),
                    ),
                    FilledButton(
                      onPressed: uploading ? null : _upload,
                      child: Text(uploading ? 'Uploading…' : 'Upload'),
                    ),
                  ],
                ),
              ),
            ),
          if (loading) const ScreenLoader(),
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
                    IconButton(
                      tooltip: 'Download',
                      onPressed: () => _download(d),
                      icon: const Icon(Icons.download_rounded),
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
