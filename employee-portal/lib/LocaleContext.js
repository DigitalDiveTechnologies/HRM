'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const MESSAGES = {
  en: {
    // Navigation & Shell
    portal_name: 'GOCs HR',
    portal_tag: 'Employee Portal',
    nav_dashboard: 'Dashboard',
    nav_attendance: 'Attendance',
    nav_leaves: 'Leaves',
    nav_onboarding: 'Onboarding',
    nav_profile: 'My Profile',
    nav_notifications: 'Notifications',
    logout: 'Logout',
    loading_portal: 'Loading your portal…',

    // Dashboard
    dash_title: 'Dashboard',
    dash_subtitle: 'Workforce overview, live statistics and operational metrics',
    loading_stats: 'Loading your workforce statistics…',
    kpi_today_attendance: "Today's Attendance",
    kpi_leave_balance: 'Leave Balance',
    kpi_onboarding_tasks: 'Onboarding Tasks',
    kpi_notifications: 'Notifications',
    kpi_active_today: 'Active Today',
    kpi_shift_open: 'Shift Open',
    kpi_days_remaining: 'Days Remaining',
    kpi_all_completed: 'All Completed',
    kpi_action_required: 'Action Required',
    kpi_unread_alerts: 'Unread Alerts',
    not_marked: 'Not marked',
    recent_attendance: 'Recent Attendance',
    recent_attendance_sub: 'Latest check-in logs & punctuality',
    all_attendance: 'All Attendance',
    leave_balances: 'Leave Balances',
    leave_balances_sub: 'Current entitlement & balance breakdown',
    apply_leave: 'Apply Leave',
    recent_leaves: 'Recent Leave Activity',
    recent_leaves_sub: 'Applied leave requests & workflow status',
    all_leaves: 'All Leaves',
    onboarding_handover: 'Onboarding & Handover',
    onboarding_handover_sub: 'Assigned equipment, accounts & tasks',
    view_items: 'View Items',

    // Common Table & Data Headers
    date: 'Date',
    check_in: 'Check In',
    check_out: 'Check Out',
    shift_schedule: 'Shift / Schedule',
    status: 'Status',
    late_min: 'Late (Min)',
    leave_type: 'Leave Type',
    from_date: 'From Date',
    to_date: 'To Date',
    total_days: 'Total Days',
    days: 'Days',
    reason: 'Reason',
    workflow_stage: 'Workflow Stage',
    used: 'Used',
    remaining: 'Remaining',
    item_title: 'Item / Title',
    due_date: 'Due Date',
    category: 'Category',
    action: 'Action',
    showing: 'Showing',
    of: 'of',
    records: 'records',
    days_left: 'days left',
    used_of: 'used of',
    total_entitlement: 'total entitlement',
    available: 'Available',
    exhausted: 'Exhausted',

    // Status Words
    approved: 'approved',
    rejected: 'rejected',
    pending: 'pending',
    present: 'present',
    late: 'late',
    recorded: 'recorded',
    done: 'done',

    // Leaves Page
    leaves_title: 'Leaves',
    leaves_subtitle: 'Leave entitlement balances, active workflows and historical requests',
    new_leave_request: 'New Leave Request',
    new_leave_request_sub: 'Submit request for line manager and HR ops approval',
    close_form: 'Close Form',
    apply_for_leave: '+ Apply For Leave',
    start_date: 'Start Date',
    end_date: 'End Date',
    reason_placeholder: 'State the reason for leave and any colleague covering urgent duties…',
    submit_leave_request: 'Submit Leave Request',
    submitting: 'Submitting…',
    cancel: 'Cancel',
    leave_request_history: 'Leave Request History',
    leave_request_history_sub: 'Track submissions, approval stages and historical records (Categorized view)',
    all_categories: 'All Categories',
    annual_leave: 'Annual Leave',
    sick_leave: 'Sick Leave',
    unpaid_leave: 'Unpaid Leave',
    maternity_leave: 'Maternity Leave',
    paternity_leave: 'Paternity Leave',
    casual_leave: 'Casual Leave',
    no_leaves_found: 'No leave requests found in this category.',
    leave_submitted_success: 'Leave request submitted successfully for manager approval.',

    // Attendance Page
    att_title: 'Attendance',
    att_subtitle: 'Complete daily check-in logs, punctuality metrics and shift records',
    total_logs: 'Total Logs',
    recorded_days: 'Recorded Days',
    on_time_present: 'On Time / Present',
    late_checkins: 'Late Check-ins',
    punctuality_gap: 'Punctuality Gap',
    late_minutes: 'Late Minutes',
    deduction_time: 'Total Deduction Time',
    att_history: 'Attendance History',
    att_history_sub: 'Chronological records of biometric and manual punches',
    loading_att: 'Loading attendance logs…',
    no_att_logs: 'No attendance records found.',

    // Onboarding Page
    onboarding_title: 'Onboarding & Tasks',
    onboarding_subtitle: 'Track your onboarding checklists, document handovers and setup tasks',
    pending_tasks: 'Pending Tasks',
    completed_tasks: 'Completed',
    total_assigned: 'Total Assigned',
    onboarding_checklist: 'Onboarding Checklist',
    onboarding_checklist_sub: 'Complete and acknowledge company setup items',
    mark_as_done: 'Mark Done',
    no_onboarding_tasks: 'No onboarding tasks assigned.',

    // Profile Page
    profile_title: 'My Profile',
    profile_subtitle: 'View your employee master profile and division assignment',
    company: 'Company / Division',
    department: 'Department',
    designation: 'Designation',
    joining_date: 'Joining Date',
    employee_code: 'Employee Code',
    email_address: 'Email Address',
    app_password: 'App Password',
    phone_number: 'Phone Number',
    national_id: 'National ID / Iqama',
    nationality: 'Nationality',
    citizen_id_address: 'Citizen ID address',
    residential_address: 'Residential address',
    personal_info: 'Personal Information',
    employment_info: 'Employment Information',
    job_company_details: 'Job & Company Details',
    account_contact_info: 'Account & Contact Information',
    preview: 'Preview',
    download: 'Download',
    close_preview: 'Close Preview',
    open_in_new_tab: 'Open Document in New Tab',

    // Notifications Page
    notif_title: 'Notifications & Alerts',
    notif_subtitle: 'Stay updated with your important workforce alerts, reminders and announcements',
    mark_all_read: 'Mark all as read',
    mark_read: 'Mark read',
    no_notifications: 'No notifications at this time.',
    unread: 'Unread',
    read: 'Read',
  },
  ar: {
    // Navigation & Shell
    portal_name: 'GOCs HR',
    portal_tag: 'بوابة الموظف',
    nav_dashboard: 'لوحة التحكم',
    nav_attendance: 'الحضور والانصراف',
    nav_leaves: 'الإجازات',
    nav_onboarding: 'التهيئة والمهام',
    nav_profile: 'ملفي الشخصي',
    nav_notifications: 'الإشعارات',
    logout: 'تسجيل الخروج',
    loading_portal: 'جاري تحميل البوابة…',

    // Dashboard
    dash_title: 'لوحة التحكم',
    dash_subtitle: 'نظرة عامة على القوى العاملة، الإحصائيات الحية والمقاييس التشغيلية',
    loading_stats: 'جاري تحميل إحصائياتك…',
    kpi_today_attendance: 'حضور اليوم',
    kpi_leave_balance: 'رصيد الإجازات',
    kpi_onboarding_tasks: 'مهام التهيئة',
    kpi_notifications: 'الإشعارات',
    kpi_active_today: 'نشط اليوم',
    kpi_shift_open: 'الوردية مفتوحة',
    kpi_days_remaining: 'أيام متبقية',
    kpi_all_completed: 'مكتملة بالكامل',
    kpi_action_required: 'يتطلب إجراء',
    kpi_unread_alerts: 'تنبيهات غير مقروءة',
    not_marked: 'غير مسجل',
    recent_attendance: 'سجل الحضور الأخير',
    recent_attendance_sub: 'أحدث سجلات تسجيل الدخول والالتزام بالمواعيد',
    all_attendance: 'جميع سجلات الحضور',
    leave_balances: 'أرصدة الإجازات',
    leave_balances_sub: 'تفاصيل الاستحقاق الحالي والرصيد المتبقي',
    apply_leave: 'تقديم طلب إجازة',
    recent_leaves: 'نشاط الإجازات الأخير',
    recent_leaves_sub: 'طلبات الإجازة المقدمة وحالة سير العمل',
    all_leaves: 'جميع الإجازات',
    onboarding_handover: 'التهيئة والتسليم',
    onboarding_handover_sub: 'المهام، المعدات والحسابات المخصصة لك',
    view_items: 'عرض العناصر',

    // Common Table & Data Headers
    date: 'التاريخ',
    check_in: 'تسجيل الدخول',
    check_out: 'تسجيل الخروج',
    shift_schedule: 'الوردية / الجدول',
    status: 'الحالة',
    late_min: 'التأخير (دقيقة)',
    leave_type: 'نوع الإجازة',
    from_date: 'من تاريخ',
    to_date: 'إلى تاريخ',
    total_days: 'إجمالي الأيام',
    days: 'أيام',
    reason: 'السبب',
    workflow_stage: 'مرحلة الاعتماد',
    used: 'المستخدم',
    remaining: 'المتبقي',
    item_title: 'العنصر / العنوان',
    due_date: 'تاريخ الاستحقاق',
    category: 'الفئة',
    action: 'الإجراء',
    showing: 'عرض',
    of: 'من أصل',
    records: 'سجلات',
    days_left: 'أيام متبقية',
    used_of: 'مستخدم من',
    total_entitlement: 'إجمالي الاستحقاق',
    available: 'متاح',
    exhausted: 'مستنفد',

    // Status Words
    approved: 'معتمد',
    rejected: 'مرفوض',
    pending: 'قيد الانتظار',
    present: 'حاضر',
    late: 'متأخر',
    recorded: 'مسجل',
    done: 'مكتمل',

    // Leaves Page
    leaves_title: 'الإجازات',
    leaves_subtitle: 'أرصدة الاستحقاق، مسارات الاعتماد وسجل الطلبات التاريخية',
    new_leave_request: 'طلب إجازة جديد',
    new_leave_request_sub: 'تقديم طلب لاعتماد المدير المباشر والموارد البشرية',
    close_form: 'إغلاق النموذج',
    apply_for_leave: '+ طلب إجازة جديدة',
    start_date: 'تاريخ البدء',
    end_date: 'تاريخ الانتهاء',
    reason_placeholder: 'اذكر سبب الإجازة وزميل العمل المغطي للمهام العاجلة…',
    submit_leave_request: 'إرسال طلب الإجازة',
    submitting: 'جاري الإرسال…',
    cancel: 'إلغاء',
    leave_request_history: 'سجل طلبات الإجازة',
    leave_request_history_sub: 'متابعة الطلبات ومراحل الموافقة (عرض مصنف حسب الفئة)',
    all_categories: 'جميع الفئات',
    annual_leave: 'إجازة سنوية',
    sick_leave: 'إجازة مرضية',
    unpaid_leave: 'إجازة بدون راتب',
    maternity_leave: 'إجازة أمومة',
    paternity_leave: 'إجازة أبوة',
    casual_leave: 'إجازة عارضة',
    no_leaves_found: 'لا توجد طلبات إجازة في هذه الفئة.',
    leave_submitted_success: 'تم إرسال طلب الإجازة بنجاح للاعتماد.',

    // Attendance Page
    att_title: 'الحضور والانصراف',
    att_subtitle: 'سجلات الدخول اليومية، مقاييس الالتزام وتفاصيل الورديات',
    total_logs: 'إجمالي السجلات',
    recorded_days: 'أيام مسجلة',
    on_time_present: 'في الموعد / حاضر',
    late_checkins: 'تسجيلات متأخرة',
    punctuality_gap: 'فارق الالتزام',
    late_minutes: 'دقائق التأخير',
    deduction_time: 'إجمالي وقت الخصم',
    att_history: 'سجل الحضور',
    att_history_sub: 'سجلات البصمة الإلكترونية والتسجيل اليدوي',
    loading_att: 'جاري تحميل سجلات الحضور…',
    no_att_logs: 'لا توجد سجلات حضور.',

    // Onboarding Page
    onboarding_title: 'التهيئة والمهام',
    onboarding_subtitle: 'متابعة قوائم التدريب والتهيئة وتسليم المستندات',
    pending_tasks: 'مهام معلقة',
    completed_tasks: 'مكتملة',
    total_assigned: 'إجمالي المهام المخصصة',
    onboarding_checklist: 'قائمة مهام التهيئة',
    onboarding_checklist_sub: 'إكمال وتأكيد عناصر الإعداد الخاصة بالشركة',
    mark_as_done: 'تحديد كمكتمل',
    no_onboarding_tasks: 'لا توجد مهام تهيئة مخصصة.',

    // Profile Page
    profile_title: 'ملفي الشخصي',
    profile_subtitle: 'عرض ملف الموظف الأساسي وتفاصيل تعيين الشركة والفرع',
    company: 'الشركة / الفرع',
    department: 'القسم',
    designation: 'المسمى الوظيفي',
    joining_date: 'تاريخ الالتحاق',
    employee_code: 'الرقم الوظيفي',
    email_address: 'البريد الإلكتروني',
    app_password: 'كلمة مرور التطبيق',
    phone_number: 'رقم الهاتف',
    national_id: 'رقم الهوية / الإقامة',
    nationality: 'الجنسية',
    citizen_id_address: 'عنوان بطاقة الهوية',
    residential_address: 'العنوان السكني',
    personal_info: 'المعلومات الشخصية',
    employment_info: 'معلومات الوظيفة',
    job_company_details: 'تفاصيل الوظيفة والشركة',
    account_contact_info: 'معلومات الحساب والتواصل',
    preview: 'معاينة',
    download: 'تحميل',
    close_preview: 'إغلاق المعاينة',
    open_in_new_tab: 'فتح المستند في علامة تبويب جديدة',

    // Notifications Page
    notif_title: 'الإشعارات والتنبيهات',
    notif_subtitle: 'ابق على اطلاع دائم بالتنبيهات، التذكيرات والإعلانات الإدارية',
    mark_all_read: 'تحديد الكل كمقروء',
    mark_read: 'تحديد كمقروء',
    no_notifications: 'لا توجد إشعارات في الوقت الحالي.',
    unread: 'غير مقروء',
    read: 'مقروء',
  },
};

const LocaleContext = createContext({
  locale: 'en',
  dir: 'ltr',
  t: (k) => k,
  setLocale: () => {},
  toggleLocale: () => {},
});

const STORAGE_KEY = 'hr_locale';

export function LocaleProvider({ children }) {
  const [locale, setLocaleState] = useState('en');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'ar' || saved === 'en') {
        setLocaleState(saved);
        applyDom(saved);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const applyDom = useCallback((next) => {
    if (typeof document === 'undefined') return;
    const dir = next === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = next;
    document.documentElement.dir = dir;
    document.documentElement.setAttribute('data-locale', next);
  }, []);

  const setLocale = useCallback(
    (next) => {
      const loc = next === 'ar' ? 'ar' : 'en';
      setLocaleState(loc);
      applyDom(loc);
      try {
        localStorage.setItem(STORAGE_KEY, loc);
      } catch {
        /* ignore */
      }
    },
    [applyDom]
  );

  const toggleLocale = useCallback(() => {
    setLocale(locale === 'ar' ? 'en' : 'ar');
  }, [locale, setLocale]);

  const t = useCallback(
    (key) => {
      const dict = MESSAGES[locale] || MESSAGES.en;
      return dict[key] || MESSAGES.en[key] || key;
    },
    [locale]
  );

  const value = useMemo(
    () => ({
      locale,
      dir: locale === 'ar' ? 'rtl' : 'ltr',
      t,
      setLocale,
      toggleLocale,
    }),
    [locale, t, setLocale, toggleLocale]
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  return useContext(LocaleContext);
}
