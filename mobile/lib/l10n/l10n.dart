/// Phase 3 — EN/AR strings for mobile ESS/MSS chrome.
library;

class L10n {
  L10n(this.locale);
  final String locale;
  bool get isAr => locale == 'ar';

  static const _en = <String, String>{
    'ess_home': 'ESS / Home',
    'team_approvals': 'Team approvals',
    'mss': 'Manager hub',
    'my_leaves': 'My Leaves',
    'certificates': 'Certificates',
    'my_attendance': 'My Attendance',
    'my_payslips': 'My Payslips',
    'notifications': 'Notifications',
    'my_documents': 'My Documents',
    'directory': 'Directory',
    'profile': 'Profile',
    'self_service': 'Self Service',
    'language': 'Language',
    'logout': 'Logout',
    'loading': 'Loading…',
    'check_in': 'Check in',
    'check_out': 'Check out',
    'quick_actions': 'Quick actions',
    'leave_balances': 'Leave balances',
    'profile_title': 'Profile',
    'profile_subtitle': 'Your account details',
    'category': 'Category',
    'employee_id': 'Employee ID',
    'approve': 'Approve',
    'reject': 'Reject',
    'pending': 'Pending',
    'no_data': 'Nothing here yet.',
    'arabic': 'العربية',
    'english': 'English',
  };

  static const _ar = <String, String>{
    'ess_home': 'الخدمة الذاتية',
    'team_approvals': 'موافقات الفريق',
    'mss': 'مركز المدير',
    'my_leaves': 'إجازاتي',
    'certificates': 'الشهادات',
    'my_attendance': 'حضوري',
    'my_payslips': 'كشوف راتبي',
    'notifications': 'الإشعارات',
    'my_documents': 'مستنداتي',
    'directory': 'الدليل',
    'profile': 'الملف الشخصي',
    'self_service': 'الخدمة الذاتية',
    'language': 'اللغة',
    'logout': 'تسجيل الخروج',
    'loading': 'جاري التحميل…',
    'check_in': 'تسجيل حضور',
    'check_out': 'تسجيل انصراف',
    'quick_actions': 'إجراءات سريعة',
    'leave_balances': 'أرصدة الإجازات',
    'profile_title': 'الملف الشخصي',
    'profile_subtitle': 'تفاصيل حسابك',
    'category': 'الفئة',
    'employee_id': 'رقم الموظف',
    'approve': 'موافقة',
    'reject': 'رفض',
    'pending': 'معلّق',
    'no_data': 'لا توجد بيانات بعد.',
    'arabic': 'العربية',
    'english': 'English',
  };

  String t(String key) {
    final table = isAr ? _ar : _en;
    return table[key] ?? _en[key] ?? key;
  }

  String navLabel(String id) {
    switch (id) {
      case 'ess':
        return t('ess_home');
      case 'team_approvals':
        return t('team_approvals');
      case 'mss':
        return t('mss');
      case 'leave':
        return t('my_leaves');
      case 'certificates':
        return t('certificates');
      case 'attendance':
        return t('my_attendance');
      case 'payslips':
        return t('my_payslips');
      case 'notifications':
        return t('notifications');
      case 'documents':
        return t('my_documents');
      case 'directory':
        return t('directory');
      case 'profile':
        return t('profile');
      default:
        return id;
    }
  }
}
