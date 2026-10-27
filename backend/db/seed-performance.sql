-- Seed realistic demo performance goals (hierarchical) and reviews with potential ratings
DO $$
DECLARE
    emp1 INT;
    emp2 INT;
    emp3 INT;
    emp4 INT;
    parentGoal1 INT;
    parentGoal2 INT;
    revId1 INT;
    revId2 INT;
BEGIN
    SELECT id INTO emp1 FROM employees WHERE id = 1;
    SELECT id INTO emp2 FROM employees WHERE id = 2;
    SELECT id INTO emp3 FROM employees WHERE id = 3;
    SELECT id INTO emp4 FROM employees WHERE id = 4;

    -- If emp1 is available, seed hierarchical OKRs
    IF emp1 IS NOT NULL THEN
        -- Parent Goal 1: Expand Q4 Operational Efficiency
        INSERT INTO performance_goals (employee_id, title, kpi, target_value, progress_pct, period_label, status, weightage, target_metric, current_metric, due_date)
        VALUES (emp1, 'Scale Core Engineering & Operational Delivery', 'System Stability & Speed', '99.9% Uptime', 75, 'H2 2026', 'active', 100, '99.9%', '99.5%', '2026-12-31')
        RETURNING id INTO parentGoal1;

        -- Sub-goal 1a
        INSERT INTO performance_goals (employee_id, title, kpi, target_value, progress_pct, period_label, status, parent_goal_id, weightage, target_metric, current_metric, due_date)
        VALUES (emp1, 'Automate DB backup and failover pipeline', 'Disaster Recovery RTO', '< 15 mins', 100, 'H2 2026', 'completed', parentGoal1, 40, '< 15 mins', '12 mins', '2026-11-15');

        -- Sub-goal 1b
        INSERT INTO performance_goals (employee_id, title, kpi, target_value, progress_pct, period_label, status, parent_goal_id, weightage, target_metric, current_metric, due_date)
        VALUES (emp1, 'Reduce API response latency across core HR endpoints', 'p95 Response Time', '< 250ms', 60, 'H2 2026', 'active', parentGoal1, 60, '< 250ms', '320ms', '2026-12-15');

        -- Review 1 with high rating and potential
        INSERT INTO performance_reviews (employee_id, reviewer_name, review_type, rating, summary, status, review_date, template_id, potential_rating, answers_json)
        VALUES (emp1, 'Leadership Committee', 'annual', 4.5, 'Exceptional contributor demonstrating strong architectural leadership and execution consistency.', 'submitted', CURRENT_DATE - 5, 1, 4.8,
        '[{"questionId": "q1", "score": 5, "comment": "Outstanding technical execution"}, {"questionId": "q2", "score": 4, "comment": "Proactive and creative problem solver"}]'::jsonb)
        RETURNING id INTO revId1;
    END IF;

    IF emp2 IS NOT NULL THEN
        -- Parent Goal 2: Talent Acquisition & Onboarding SLA
        INSERT INTO performance_goals (employee_id, title, kpi, target_value, progress_pct, period_label, status, weightage, target_metric, current_metric, due_date)
        VALUES (emp2, 'Accelerate Technical Onboarding & Compliance', 'Time to Productivity', '21 Days', 50, 'H2 2026', 'active', 100, '21 Days', '28 Days', '2026-12-31')
        RETURNING id INTO parentGoal2;

        -- Sub-goal 2a
        INSERT INTO performance_goals (employee_id, title, kpi, target_value, progress_pct, period_label, status, parent_goal_id, weightage, target_metric, current_metric, due_date)
        VALUES (emp2, 'Digitalize medical fitness & visa tracking workflows', 'Document Completion Rate', '100%', 80, 'H2 2026', 'active', parentGoal2, 50, '100%', '80%', '2026-11-30');

        -- Sub-goal 2b
        INSERT INTO performance_goals (employee_id, title, kpi, target_value, progress_pct, period_label, status, parent_goal_id, weightage, target_metric, current_metric, due_date)
        VALUES (emp2, 'Roll out self-service benefits enrollment portal', 'Employee Adoption', '95%', 20, 'H2 2026', 'active', parentGoal2, 50, '95%', '20%', '2026-12-31');

        -- Review 2: High potential, solid performer
        INSERT INTO performance_reviews (employee_id, reviewer_name, review_type, rating, summary, status, review_date, template_id, potential_rating, answers_json)
        VALUES (emp2, 'HR Director', 'mid_year', 3.7, 'Dependable and showing high learning velocity in people operations.', 'submitted', CURRENT_DATE - 10, 1, 4.2,
        '[{"questionId": "q1", "score": 4, "comment": "Strong teamwork"}, {"questionId": "q2", "score": 4, "comment": "Fast learner"}]'::jsonb)
        RETURNING id INTO revId2;

        -- Peer review nomination if emp1 & emp2 exist
        IF emp1 IS NOT NULL AND revId2 IS NOT NULL THEN
            INSERT INTO performance_peer_nominations (review_id, nominee_id, reviewer_id, status, is_anonymous, feedback_json)
            VALUES (revId2, emp2, emp1, 'approved', TRUE, '{"strengths": "Great communicator and reliable partner.", "growthAreas": "Can delegate more complex tasks.", "rating": 4.5}'::jsonb);
        END IF;
    END IF;

    IF emp3 IS NOT NULL THEN
        -- Review 3: Core Performer
        INSERT INTO performance_reviews (employee_id, reviewer_name, review_type, rating, summary, status, review_date, template_id, potential_rating)
        VALUES (emp3, 'Operations Lead', 'annual', 3.4, 'Consistent performer meeting all baseline SLA requirements.', 'acknowledged', CURRENT_DATE - 20, 1, 3.2);
    END IF;

    IF emp4 IS NOT NULL THEN
        -- Review 4: High Performer / Specialist
        INSERT INTO performance_reviews (employee_id, reviewer_name, review_type, rating, summary, status, review_date, template_id, potential_rating)
        VALUES (emp4, 'Division Head', 'annual', 4.2, 'Deep domain knowledge and trusted specialist in company systems.', 'submitted', CURRENT_DATE - 15, 1, 2.8);
    END IF;

END $$;
