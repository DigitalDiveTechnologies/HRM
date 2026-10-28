import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../services/api_client.dart';
import '../state/app_state.dart';
import '../theme/app_theme.dart';
import '../utils/format.dart';
import '../widgets/ui_kit.dart';

class TeamCalendarView extends StatefulWidget {
  const TeamCalendarView({super.key});

  @override
  State<TeamCalendarView> createState() => _TeamCalendarViewState();
}

class _TeamCalendarViewState extends State<TeamCalendarView> {
  DateTime currentMonth = DateTime(DateTime.now().year, DateTime.now().month, 1);
  DateTime? selectedDate;
  List<dynamic> leaves = [];
  bool loading = true;
  String? error;
  String? selectedDepartment;

  @override
  void initState() {
    super.initState();
    _fetchCalendar();
  }

  Future<void> _fetchCalendar() async {
    setState(() {
      loading = true;
      error = null;
    });

    final api = context.read<AppState>().api;
    final startStr = DateFormat('yyyy-MM-01').format(currentMonth);
    final lastDay = DateTime(currentMonth.year, currentMonth.month + 1, 0).day;
    final endStr = '${DateFormat('yyyy-MM').format(currentMonth)}-${lastDay.toString().padLeft(2, '0')}';

    try {
      final res = await api.request('/leave/calendar?start=$startStr&end=$endStr');
      if (!mounted) return;
      setState(() {
        leaves = res as List<dynamic>;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => error = e.message);
    } catch (e) {
      if (!mounted) return;
      setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  void _prevMonth() {
    setState(() {
      currentMonth = DateTime(currentMonth.year, currentMonth.month - 1, 1);
      selectedDate = null;
    });
    _fetchCalendar();
  }

  void _nextMonth() {
    setState(() {
      currentMonth = DateTime(currentMonth.year, currentMonth.month + 1, 1);
      selectedDate = null;
    });
    _fetchCalendar();
  }

  void _todayMonth() {
    final now = DateTime.now();
    setState(() {
      currentMonth = DateTime(now.year, now.month, 1);
      selectedDate = now;
    });
    _fetchCalendar();
  }

  List<Map<String, dynamic>> _leavesForDate(DateTime date) {
    final dateIso = DateFormat('yyyy-MM-dd').format(date);
    final list = <Map<String, dynamic>>[];

    for (final raw in leaves) {
      final r = Map<String, dynamic>.from(raw as Map);
      final sRaw = pick(r, ['startDate', 'start_date']);
      final eRaw = pick(r, ['endDate', 'end_date']);
      if (sRaw.isEmpty || eRaw.isEmpty) continue;

      final s = sRaw.length >= 10 ? sRaw.substring(0, 10) : sRaw;
      final e = eRaw.length >= 10 ? eRaw.substring(0, 10) : eRaw;

      if (dateIso.compareTo(s) >= 0 && dateIso.compareTo(e) <= 0) {
        if (selectedDepartment == null ||
            selectedDepartment == 'All' ||
            pick(r, ['departmentName', 'department_name']) == selectedDepartment) {
          list.add(r);
        }
      }
    }
    return list;
  }

  /// Checks if 2 or more colleagues in the same department are on leave on [date].
  /// Returns map of departmentName -> count.
  Map<String, int> _departmentOverlapOnDate(DateTime date) {
    final dayLeaves = _leavesForDate(date);
    final deptCounts = <String, int>{};
    for (final r in dayLeaves) {
      final dept = pick(r, ['departmentName', 'department_name'], 'General');
      deptCounts[dept] = (deptCounts[dept] ?? 0) + 1;
    }
    // Filter to only overlaps (count >= 2)
    return Map.fromEntries(deptCounts.entries.where((e) => e.value >= 2));
  }

  void _showDateDetailSheet(DateTime date) {
    final dayLeaves = _leavesForDate(date);
    final overlaps = _departmentOverlapOnDate(date);

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return SafeArea(
          child: Container(
            constraints: BoxConstraints(
              maxHeight: MediaQuery.sizeOf(ctx).height * 0.8,
            ),
            decoration: BoxDecoration(
              color: T.surface(ctx),
              borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
            ),
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 16),
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
                      color: T.muted(ctx).withValues(alpha: 0.3),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            DateFormat('EEEE, MMMM d, yyyy').format(date),
                            style: Theme.of(ctx).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          const SizedBox(height: 2),
                          Text(
                            '${dayLeaves.length} colleague${dayLeaves.length == 1 ? '' : 's'} away',
                            style: TextStyle(color: T.muted(ctx), fontSize: 13),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      onPressed: () => Navigator.of(ctx).pop(),
                      icon: const Icon(Icons.close),
                    ),
                  ],
                ),
                const SizedBox(height: 12),

                // Overlap Warnings for this date
                if (overlaps.isNotEmpty) ...[
                  ...overlaps.entries.map((entry) {
                    return Container(
                      margin: const EdgeInsets.only(bottom: 10),
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      decoration: BoxDecoration(
                        color: AppColors.warn.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: AppColors.warn.withValues(alpha: 0.4)),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.warning_amber_rounded, color: AppColors.warn, size: 22),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              '⚠️ Team Coverage Alert: ${entry.value} colleagues on leave in ${entry.key}',
                              style: const TextStyle(
                                color: AppColors.warn,
                                fontWeight: FontWeight.w700,
                                fontSize: 13,
                              ),
                            ),
                          ),
                        ],
                      ),
                    );
                  }),
                ],

                if (dayLeaves.isEmpty)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 30),
                    child: EmptyHint('No colleagues scheduled off on this date.', icon: Icons.celebration_outlined),
                  )
                else
                  Flexible(
                    child: ListView.separated(
                      shrinkWrap: true,
                      itemCount: dayLeaves.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 10),
                      itemBuilder: (context, idx) {
                        final item = dayLeaves[idx];
                        final name = pick(item, ['fullName', 'full_name'], 'Colleague');
                        final dept = pick(item, ['departmentName', 'department_name'], 'Department');
                        final lType = pick(item, ['leaveType', 'leave_type'], 'Annual Leave');
                        final sDate = pick(item, ['startDate', 'start_date']);
                        final eDate = pick(item, ['endDate', 'end_date']);
                        final days = pick(item, ['days'], '1');
                        final reason = pick(item, ['reason']);

                        return Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: T.surface(context),
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(color: T.cardBorder(context)),
                          ),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              InitialsAvatar(name, size: 42),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      name,
                                      style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15),
                                    ),
                                    const SizedBox(height: 4),
                                    Wrap(
                                      spacing: 6,
                                      runSpacing: 4,
                                      children: [
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                                          decoration: BoxDecoration(
                                            color: AppColors.accent.withValues(alpha: 0.12),
                                            borderRadius: BorderRadius.circular(6),
                                          ),
                                          child: Text(
                                            dept,
                                            style: const TextStyle(
                                              color: AppColors.accent,
                                              fontWeight: FontWeight.w700,
                                              fontSize: 11,
                                            ),
                                          ),
                                        ),
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                                          decoration: BoxDecoration(
                                            color: T.muted(context).withValues(alpha: 0.12),
                                            borderRadius: BorderRadius.circular(6),
                                          ),
                                          child: Text(
                                            lType,
                                            style: TextStyle(
                                              color: T.ink(context),
                                              fontWeight: FontWeight.w600,
                                              fontSize: 11,
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 6),
                                    Text(
                                      '${formatDate(sDate)} → ${formatDate(eDate)} · $days day(s)',
                                      style: TextStyle(color: T.muted(context), fontSize: 12),
                                    ),
                                    if (reason.isNotEmpty) ...[
                                      const SizedBox(height: 4),
                                      Text(
                                        'Note: $reason',
                                        style: TextStyle(color: T.muted(context), fontSize: 11.5, fontStyle: FontStyle.italic),
                                      ),
                                    ],
                                  ],
                                ),
                              ),
                            ],
                          ),
                        );
                      },
                    ),
                  ),
              ],
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    // Collect all departments for filter
    final departments = <String>{'All'};
    for (final raw in leaves) {
      final r = Map<String, dynamic>.from(raw as Map);
      final dept = pick(r, ['departmentName', 'department_name']);
      if (dept.isNotEmpty) departments.add(dept);
    }

    // Identify month overlap alerts
    int monthOverlapDays = 0;
    final daysInMonth = DateTime(currentMonth.year, currentMonth.month + 1, 0).day;
    for (int day = 1; day <= daysInMonth; day++) {
      final date = DateTime(currentMonth.year, currentMonth.month, day);
      if (_departmentOverlapOnDate(date).isNotEmpty) {
        monthOverlapDays++;
      }
    }

    return RefreshIndicator(
      onRefresh: _fetchCalendar,
      child: ListView(
        padding: screenListPadding(context),
        children: [
          const PageHero(
            title: 'Team Calendar',
            subtitle: 'Department absence schedules and coverage alerts',
            trailing: Icon(Icons.calendar_month_rounded, color: Colors.white, size: 36),
          ),

          // Month navigation header
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 4),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                IconButton(
                  onPressed: _prevMonth,
                  icon: const Icon(Icons.chevron_left_rounded, size: 28),
                  tooltip: 'Previous month',
                ),
                InkWell(
                  onTap: _todayMonth,
                  borderRadius: BorderRadius.circular(8),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    child: Text(
                      DateFormat('MMMM yyyy').format(currentMonth),
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.w900,
                            letterSpacing: 0.3,
                          ),
                    ),
                  ),
                ),
                IconButton(
                  onPressed: _nextMonth,
                  icon: const Icon(Icons.chevron_right_rounded, size: 28),
                  tooltip: 'Next month',
                ),
              ],
            ),
          ),

          // Department filter chips if multiple departments
          if (departments.length > 2)
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Row(
                children: departments.map((d) {
                  final active = (selectedDepartment ?? 'All') == d;
                  return Padding(
                    padding: const EdgeInsets.only(right: 8, bottom: 4),
                    child: ChoiceChip(
                      label: Text(d),
                      selected: active,
                      onSelected: (_) => setState(() => selectedDepartment = d),
                      selectedColor: AppColors.accent,
                      labelStyle: TextStyle(
                        color: active ? Colors.white : T.ink(context),
                        fontSize: 12,
                        fontWeight: active ? FontWeight.w700 : FontWeight.w500,
                      ),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    ),
                  );
                }).toList(),
              ),
            ),

          // Monthly Overlap Alert Banner
          if (monthOverlapDays > 0)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                decoration: BoxDecoration(
                  color: AppColors.warn.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.warn.withValues(alpha: 0.4)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.warning_amber_rounded, color: AppColors.warn, size: 22),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        '⚠️ Team Coverage Alert: $monthOverlapDays day(s) this month have 2+ departmental colleagues on leave.',
                        style: const TextStyle(
                          color: AppColors.warn,
                          fontWeight: FontWeight.w700,
                          fontSize: 12.5,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),

          if (error != null)
            Padding(
              padding: const EdgeInsets.all(16),
              child: Text(error!, style: const TextStyle(color: AppColors.danger)),
            ),

          if (loading)
            const ScreenLoader(padding: 40)
          else ...[
            // Calendar Grid Card
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: SectionCard(
                padding: const EdgeInsets.all(14),
                child: Column(
                  children: [
                    // Day of Week row
                    Row(
                      children: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) {
                        return Expanded(
                          child: Center(
                            child: Text(
                              d,
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                                color: T.muted(context),
                              ),
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                    const SizedBox(height: 10),
                    const Divider(height: 1),
                    const SizedBox(height: 8),

                    // Calendar Days
                    _buildMonthGrid(),
                  ],
                ),
              ),
            ),

            // Instruction note
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 4),
              child: Row(
                children: [
                  Container(
                    width: 8,
                    height: 8,
                    decoration: const BoxDecoration(shape: BoxShape.circle, color: AppColors.accent),
                  ),
                  const SizedBox(width: 6),
                  Text('Scheduled leave', style: TextStyle(color: T.muted(context), fontSize: 11.5)),
                  const SizedBox(width: 16),
                  Container(
                    width: 8,
                    height: 8,
                    decoration: const BoxDecoration(shape: BoxShape.circle, color: AppColors.warn),
                  ),
                  const SizedBox(width: 6),
                  Text('Coverage overlap', style: TextStyle(color: T.muted(context), fontSize: 11.5)),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildMonthGrid() {
    final firstDayWeekday = DateTime(currentMonth.year, currentMonth.month, 1).weekday % 7; // 0 for Sun
    final daysInMonth = DateTime(currentMonth.year, currentMonth.month + 1, 0).day;
    final totalCells = ((firstDayWeekday + daysInMonth + 6) ~/ 7) * 7;
    final today = DateTime.now();

    final rows = <Widget>[];
    for (int week = 0; week < totalCells / 7; week++) {
      final days = <Widget>[];
      for (int dow = 0; dow < 7; dow++) {
        final cellIdx = week * 7 + dow;
        final dayNum = cellIdx - firstDayWeekday + 1;

        if (dayNum < 1 || dayNum > daysInMonth) {
          days.add(const Expanded(child: SizedBox(height: 52)));
        } else {
          final cellDate = DateTime(currentMonth.year, currentMonth.month, dayNum);
          final dayLeaves = _leavesForDate(cellDate);
          final overlap = _departmentOverlapOnDate(cellDate);
          final isToday = cellDate.year == today.year && cellDate.month == today.month && cellDate.day == today.day;
          final isSelected = selectedDate != null &&
              selectedDate!.year == cellDate.year &&
              selectedDate!.month == cellDate.month &&
              selectedDate!.day == cellDate.day;

          days.add(
            Expanded(
              child: InkWell(
                onTap: () {
                  setState(() => selectedDate = cellDate);
                  _showDateDetailSheet(cellDate);
                },
                borderRadius: BorderRadius.circular(10),
                child: Container(
                  height: 52,
                  margin: const EdgeInsets.all(2),
                  decoration: BoxDecoration(
                    color: isSelected
                        ? AppColors.accent.withValues(alpha: 0.18)
                        : isToday
                            ? AppColors.accent.withValues(alpha: 0.08)
                            : Colors.transparent,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                      color: isSelected
                          ? AppColors.accent
                          : isToday
                              ? AppColors.accent.withValues(alpha: 0.5)
                              : Colors.transparent,
                      width: isSelected ? 1.5 : 1.0,
                    ),
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        '$dayNum',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: isToday || isSelected ? FontWeight.w900 : FontWeight.w600,
                          color: isToday
                              ? AppColors.accent
                              : T.ink(context),
                        ),
                      ),
                      const SizedBox(height: 3),
                      if (dayLeaves.isNotEmpty)
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            if (overlap.isNotEmpty)
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                                decoration: BoxDecoration(
                                  color: AppColors.warn,
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: Text(
                                  '${dayLeaves.length}',
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 9,
                                    fontWeight: FontWeight.w900,
                                    height: 1,
                                  ),
                                ),
                              )
                            else
                              Container(
                                width: 7,
                                height: 7,
                                decoration: const BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: AppColors.accent,
                                ),
                              ),
                          ],
                        )
                      else
                        const SizedBox(height: 7),
                    ],
                  ),
                ),
              ),
            ),
          );
        }
      }
      rows.add(Row(children: days));
      rows.add(const SizedBox(height: 2));
    }

    return Column(children: rows);
  }
}
