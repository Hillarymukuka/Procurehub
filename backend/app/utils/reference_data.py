"""Default reference data for departments and procurement categories.

The helper functions in this module are used to seed or backfill
lookup data across scripts, migrations, and ad-hoc utilities. Keeping
the canonical lists here avoids duplication and ensures every entry is
described consistently.
"""

from __future__ import annotations

from typing import Iterable, Tuple

from sqlalchemy.orm import Session

DepartmentSeed = Tuple[str, str]
CategorySeed = Tuple[str, str]

DEFAULT_DEPARTMENTS: list[DepartmentSeed] = [
    ("Executive", "Office of the CEO and executive leadership support"),
    ("Finance", "Budgeting, accounting, and financial planning activities"),
    ("Procurement", "Strategic sourcing and supplier relationship management"),
    ("Operations", "Day-to-day business operations and coordination"),
    ("Human Resources", "Talent acquisition, retention, and employee relations"),
    ("Information Technology", "Infrastructure, software, and IT governance"),
    ("Legal & Compliance", "Contracts, regulatory requirements, and policies"),
    ("Risk Management", "Enterprise risk assessments and mitigation planning"),
    ("Facilities Management", "Building maintenance, workspace, and utilities"),
    ("Logistics & Supply Chain", "Distribution, warehousing, and inventory control"),
    ("Customer Experience", "Customer success, care, and service quality"),
    ("Marketing & Communications", "Brand, communications, and campaign execution"),
    ("Research & Innovation", "Product research, pilots, and innovation programs"),
    ("Quality Assurance", "Process audits, compliance checks, and continuous improvement"),
    ("Health & Safety", "Workplace safety, incident reporting, and employee wellness"),
    ("Training & Development", "Learning programs, onboarding, and leadership development"),
    ("Business Development", "Partnerships, bids, and market expansion initiatives"),
    ("Project Management Office", "Portfolio governance and project delivery support"),
    ("Corporate Services", "Executive admin support, governance, and board liaison"),
    ("Data & Analytics", "Business intelligence, reporting, and data governance"),
]

DEFAULT_CATEGORIES: list[CategorySeed] = [
    # Construction & Infrastructure
    ("Construction Services", "General construction, building, and infrastructure projects"),
    ("Civil Engineering", "Roads, bridges, water systems, and civil infrastructure"),
    ("Electrical Works", "Electrical installations, maintenance, and systems"),
    ("Plumbing & HVAC", "Plumbing, heating, ventilation, and air conditioning"),
    ("Architecture & Design", "Architectural design and planning services"),
    ("Landscaping & Grounds", "Landscape design, maintenance, and outdoor services"),
    # Technology & IT
    ("Software Development", "Custom software, applications, and system development"),
    ("IT Managed Services", "Managed IT services, helpdesk, and support contracts"),
    ("Hardware & Equipment", "Computer hardware, networking equipment, and electronics"),
    ("Telecommunications", "Phone systems, internet, and communication infrastructure"),
    ("Cybersecurity", "Security systems, monitoring, and protection services"),
    ("Cloud & Hosting", "Cloud infrastructure, hosting, and platform services"),
    ("Data & Analytics Tools", "BI platforms, analytics software, and data tooling"),
    # Professional & Advisory
    ("Legal Services", "Legal consulting, contracts, and compliance"),
    ("Accounting & Finance", "Financial services, auditing, and bookkeeping"),
    ("Human Resources Services", "HR consulting, recruitment, and payroll support"),
    ("Marketing & Advertising", "Marketing campaigns, branding, and promotional services"),
    ("Corporate Training", "Leadership, technical, and compliance training solutions"),
    ("Management Consulting", "Business strategy, process optimisation, and advisory"),
    ("Public Relations", "Media relations, crisis comms, and reputation management"),
    ("Creative & Design Services", "Graphic, UX, product, and multimedia design"),
    # Operations & Maintenance
    ("Cleaning Services", "Janitorial, maintenance, and cleaning services"),
    ("Security Services", "Security guards, surveillance, and protection"),
    ("Catering & Food Services", "Food service, catering, and hospitality"),
    ("Transportation & Logistics", "Shipping, delivery, fleet and logistics services"),
    ("Facility Management", "Building management and maintenance services"),
    ("Vehicle Fleet Management", "Vehicle leasing, maintenance, and fleet optimisation"),
    ("Travel & Accommodation", "Corporate travel, lodging, and concierge services"),
    # Manufacturing & Supply
    ("Raw Materials", "Basic materials, chemicals, and manufacturing inputs"),
    ("Office Supplies", "Stationery, office equipment, and supplies"),
    ("Industrial Equipment", "Machinery, tools, and industrial equipment"),
    ("Medical Supplies", "Healthcare equipment and medical supplies"),
    ("Safety Equipment", "Safety gear, protective equipment, and compliance tools"),
    ("Laboratory Equipment", "Lab instruments, consumables, and testing services"),
    ("Agricultural Supplies", "Seeds, fertilisers, agro-chemicals, and farming tools"),
    # Energy & Environment
    ("Energy Services", "Power generation, renewable energy, and utilities"),
    ("Environmental Services", "Waste management, recycling, and environmental consulting"),
    ("Water Management", "Water treatment, supply, and management systems"),
    ("Renewable Energy", "Solar, wind, and sustainable energy solutions"),
    ("Climate & Sustainability", "Sustainability strategy, ESG reporting, and audits"),
    # Specialist Services
    ("Training & Education", "Training programs, workshops, and educational services"),
    ("Research & Development", "R&D services, testing, and innovation"),
    ("Event Management", "Event planning, coordination, and management"),
    ("Printing & Publishing", "Printing services, publishing, and documentation"),
    ("Insurance Services", "Insurance policies, risk management, and coverage"),
    ("Recruitment Services", "Specialist recruitment, executive search, and staffing"),
    ("Customer Support Tooling", "CRM platforms, ticketing systems, and support tooling"),
    ("Health & Wellness Programs", "Employee wellness, occupational health, and medicals"),
]


def ensure_departments(session: Session, seeds: Iterable[DepartmentSeed] | None = None) -> int:
    """Ensure the provided department seeds exist; return how many were added."""
    from ..models.department import Department  # Avoid circular import at module import time

    records = seeds or DEFAULT_DEPARTMENTS
    existing = {name for (name,) in session.query(Department.name).all()}

    added = 0
    for name, description in records:
        if name in existing:
            continue
        session.add(Department(name=name, description=description))
        added += 1
    return added


def ensure_categories(session: Session, seeds: Iterable[CategorySeed] | None = None) -> int:
    """Ensure the provided category seeds exist; return how many were added."""
    from ..models.category import ProcurementCategory  # Avoid circular import at module import time

    records = seeds or DEFAULT_CATEGORIES
    existing = {name for (name,) in session.query(ProcurementCategory.name).all()}

    added = 0
    for name, description in records:
        if name in existing:
            continue
        session.add(ProcurementCategory(name=name, description=description))
        added += 1
    return added

