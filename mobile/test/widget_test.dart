import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:hr_employee_app/main.dart';

void main() {
  testWidgets('App boots', (WidgetTester tester) async {
    await tester.pumpWidget(const DigitalDiveHrApp());
    await tester.pump(const Duration(milliseconds: 100));
    expect(find.byType(MaterialApp), findsOneWidget);
  });
}
