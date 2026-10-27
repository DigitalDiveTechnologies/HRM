-- Task 3.2: Dynamic Assessment Templates & Rubric Builder
CREATE TABLE IF NOT EXISTS performance_templates (
    id SERIAL PRIMARY KEY,
    title VARCHAR(150) NOT NULL,
    description TEXT,
    review_type VARCHAR(50) NOT NULL DEFAULT 'annual', -- 'annual', 'probation', 'mid_year', '360'
    sections_json JSONB NOT NULL DEFAULT '[]'::jsonb, -- sections, competencies, rating scales
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE performance_reviews ADD COLUMN IF NOT EXISTS template_id INT REFERENCES performance_templates(id) ON DELETE SET NULL;
ALTER TABLE performance_reviews ADD COLUMN IF NOT EXISTS answers_json JSONB;
ALTER TABLE performance_reviews ADD COLUMN IF NOT EXISTS potential_rating NUMERIC(3,1) DEFAULT 3.0;

-- Seed default corporate appraisal templates if none exist
INSERT INTO performance_templates (title, description, review_type, sections_json, is_active)
SELECT 'Annual Operational & Leadership Review', 'Comprehensive annual assessment evaluating core competencies, execution quality, and strategic contribution.', 'annual',
'[
  {
    "title": "Core Competencies",
    "weight": 40,
    "questions": [
      {"id": "q1", "label": "Technical Execution & Quality", "description": "Consistently delivers work at high standards with minimal rework.", "scale": 5},
      {"id": "q2", "label": "Problem Solving & Innovation", "description": "Identifies obstacles proactively and creates practical solutions.", "scale": 5},
      {"id": "q3", "label": "Communication & Collaboration", "description": "Communicates clearly across cross-functional teams.", "scale": 5}
    ]
  },
  {
    "title": "Leadership & Culture",
    "weight": 30,
    "questions": [
      {"id": "q4", "label": "Ownership & Accountability", "description": "Takes full ownership of outcomes and drives team goals.", "scale": 5},
      {"id": "q5", "label": "Mentorship & Team Support", "description": "Supports peers and shares knowledge effectively.", "scale": 5}
    ]
  },
  {
    "title": "OKR & Goal Delivery",
    "weight": 30,
    "questions": [
      {"id": "q6", "label": "Key Results Achievement", "description": "Demonstrates measurable progress against quarterly and annual targets.", "scale": 5}
    ]
  }
]'::jsonb, TRUE
WHERE NOT EXISTS (SELECT 1 FROM performance_templates WHERE title = 'Annual Operational & Leadership Review');

INSERT INTO performance_templates (title, description, review_type, sections_json, is_active)
SELECT '360-Degree Peer & Multilateral Review', 'Multi-perspective feedback assessing teamwork, empathy, reliability, and influence.', '360',
'[
  {
    "title": "Collaboration & Teamwork",
    "weight": 50,
    "questions": [
      {"id": "q1", "label": "Team Spirit & Dependability", "description": "Can be counted on to deliver commitments on time.", "scale": 5},
      {"id": "q2", "label": "Receptiveness to Feedback", "description": "Listens actively and incorporates peer feedback constructively.", "scale": 5}
    ]
  },
  {
    "title": "Values & Communication",
    "weight": 50,
    "questions": [
      {"id": "q3", "label": "Integrity & Respect", "description": "Treats everyone with respect and upholds company culture.", "scale": 5},
      {"id": "q4", "label": "Impact & Cross-Functional Influence", "description": "Inspires others and enables smooth project workflows.", "scale": 5}
    ]
  }
]'::jsonb, TRUE
WHERE NOT EXISTS (SELECT 1 FROM performance_templates WHERE title = '360-Degree Peer & Multilateral Review');

INSERT INTO performance_templates (title, description, review_type, sections_json, is_active)
SELECT 'Probationary Assessment Rubric', 'Evaluation rubric for new hires completing their 3 or 6 month probationary period.', 'probation',
'[
  {
    "title": "Onboarding & Role Mastery",
    "weight": 50,
    "questions": [
      {"id": "q1", "label": "Job Understanding & Skill Adaptation", "description": "Grasped essential workflows and systems quickly.", "scale": 5},
      {"id": "q2", "label": "Attendance & Punctuality", "description": "Maintains disciplined attendance and follows company schedules.", "scale": 5}
    ]
  },
  {
    "title": "Cultural Fit & Initiative",
    "weight": 50,
    "questions": [
      {"id": "q3", "label": "Alignment with Company Values", "description": "Engages positively with colleagues and adopts company practices.", "scale": 5},
      {"id": "q4", "label": "Growth Mindset & Curiosity", "description": "Eager to learn and welcomes coaching.", "scale": 5}
    ]
  }
]'::jsonb, TRUE
WHERE NOT EXISTS (SELECT 1 FROM performance_templates WHERE title = 'Probationary Assessment Rubric');
