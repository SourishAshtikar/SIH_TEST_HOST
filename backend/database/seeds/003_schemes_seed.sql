-- Seed: 003_schemes_seed.sql
-- Description: Seed initial informational government schemes for prototype demonstration

INSERT INTO schemes (name, description, government_level, benefit_description, eligibility, application_information, external_link)
VALUES
(
    'Drip Irrigation Subsidy',
    'Financial assistance for farmers adopting micro-irrigation systems to improve groundwater efficiency.',
    'STATE',
    'Subsidized drip irrigation equipment with up to 85% financial assistance.',
    'Agricultural landowners in notified groundwater assessment units.',
    'Apply online through the Haryana Micro-Irrigation Portal with land title documents.',
    'https://agriharyana.gov.in'
),
(
    'Micro Irrigation Support Scheme',
    'Comprehensive state assistance for installation of on-farm micro-irrigation infrastructure.',
    'STATE',
    'Financial assistance for approved micro-irrigation systems and water storage tanks.',
    'Farmers cultivating water-intensive crops (Rice, Sugarcane) transitioning to micro-irrigation.',
    'Submit application at the District Agriculture Officer (DAO) office or State portal.',
    'https://cadwm.gov.in'
),
(
    'Sprinkler Irrigation Assistance',
    'Capital subsidy support for purchasing and installing portable and semi-permanent sprinkler sets.',
    'STATE',
    'Direct benefit subsidy covering up to 70% of sprinkler hardware costs.',
    'Small and marginal farmers holding registered agricultural land.',
    'Apply via village common service centers (CSC) or online portal.',
    'https://pmksy.gov.in'
),
(
    'Water Efficient Agriculture Initiative',
    'National mission promoting sustainable groundwater management, crop diversification, and precision irrigation.',
    'NATIONAL',
    'Technical guidance, training workshops, and incentive grants for water-saving crop adoption.',
    'Open to all registered farmers and farmer producer organizations (FPOs).
',
    'Register through the National Agriculture Outreach Portal.',
    'https://agricoop.nic.in'
),
(
    'Small Farmer Irrigation Support',
    'Targeted assistance to small and marginal holdings to establish energy-efficient community tube-well and micro-irrigation setups.',
    'STATE',
    'Financial subsidy for community borewell solar pumps and shared pipeline distribution.',
    'Small agricultural holdings under 2 hectares.',
    'Contact your assigned Village Head or Block Development Office.',
    'https://haryana.gov.in'
)
ON CONFLICT DO NOTHING;
