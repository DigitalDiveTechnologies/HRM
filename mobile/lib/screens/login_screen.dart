import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../brand.dart';
import '../services/api_client.dart';
import '../state/app_state.dart';
import '../theme/app_theme.dart';
import '../widgets/ui_kit.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> with SingleTickerProviderStateMixin {
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _obscure = true;
  bool _loading = false;
  String? _error;
  late final AnimationController _anim;

  @override
  void initState() {
    super.initState();
    _anim = AnimationController(vsync: this, duration: const Duration(milliseconds: 700))..forward();
  }

  @override
  void dispose() {
    _anim.dispose();
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await context.read<AppState>().login(_email.text, _password.text);
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();
    final dark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: dark ? const Color(0xFF020B1F) : const Color(0xFFD9F3FA),
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: dark
                ? const [Color(0xFF020B1F), Color(0xFF03142C), Color(0xFF023047)]
                : const [Color(0xFFD9F3FA), Color(0xFFF7FBFC), Color(0xFFC8EAF5)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
        ),
        child: SafeArea(
          child: Stack(
            children: [
              Positioned(
                top: -40,
                right: -30,
                child: Container(
                  width: 180,
                  height: 180,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: AppColors.accent.withValues(alpha: dark ? 0.12 : 0.18),
                  ),
                ),
              ),
              Align(
                alignment: Alignment.topRight,
                child: Padding(
                  padding: const EdgeInsets.all(10),
                  child: NavThemeButton(
                    isDark: dark,
                    onPressed: () => app.toggleTheme(),
                  ),
                ),
              ),
              Center(
                child: FadeTransition(
                  opacity: CurvedAnimation(parent: _anim, curve: Curves.easeOut),
                  child: SlideTransition(
                    position: Tween<Offset>(begin: const Offset(0, 0.06), end: Offset.zero)
                        .animate(CurvedAnimation(parent: _anim, curve: Curves.easeOutCubic)),
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 420),
                      child: SingleChildScrollView(
                        padding: const EdgeInsets.all(22),
                        child: SectionCard(
                          padding: const EdgeInsets.all(24),
                          child: FormSpacedColumn(
                            children: [
                              Row(
                                children: [
                                  ClipRRect(
                                    borderRadius: BorderRadius.circular(14),
                                    child: Image.asset('assets/logo.webp', width: 52, height: 52),
                                  ),
                                  const SizedBox(width: 12),
                                  const Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          Brand.loginTitle,
                                          style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18, letterSpacing: -0.3),
                                        ),
                                        Text(Brand.loginSubtitle, style: TextStyle(fontSize: 12.5)),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                              Text(
                                'Welcome back',
                                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                                      fontWeight: FontWeight.w800,
                                      letterSpacing: -0.5,
                                    ),
                              ),
                              Text(
                                'Employees — attendance, leave & self-service.',
                                style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: T.muted(context)),
                              ),
                              if (_error != null)
                                Container(
                                  padding: const EdgeInsets.all(12),
                                  decoration: BoxDecoration(
                                    color: AppColors.danger.withValues(alpha: 0.1),
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  child: Text(
                                    _error!,
                                    style: const TextStyle(color: AppColors.danger, fontWeight: FontWeight.w600),
                                  ),
                                ),
                              TextField(
                                controller: _email,
                                keyboardType: TextInputType.emailAddress,
                                decoration: const InputDecoration(
                                  labelText: 'Work email',
                                  prefixIcon: Icon(Icons.mail_outline_rounded),
                                ),
                              ),
                              TextField(
                                controller: _password,
                                obscureText: _obscure,
                                onSubmitted: (_) => _loading ? null : _submit(),
                                decoration: InputDecoration(
                                  labelText: 'Password',
                                  prefixIcon: const Icon(Icons.lock_outline_rounded),
                                  suffixIcon: IconButton(
                                    onPressed: () => setState(() => _obscure = !_obscure),
                                    icon: Icon(_obscure ? Icons.visibility_rounded : Icons.visibility_off_rounded),
                                  ),
                                ),
                              ),
                              FilledButton(
                                onPressed: _loading ? null : _submit,
                                child: Text(_loading ? 'Signing in…' : 'Sign in'),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
