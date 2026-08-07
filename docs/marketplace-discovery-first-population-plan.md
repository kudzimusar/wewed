# Wewed Marketplace Discovery-First Population Plan

## Goal

Build the Zimbabwe wedding marketplace toward **27,000 legitimate unique service-provider profiles** while preserving one canonical profile per real business and allowing each provider to participate in multiple Wewed categories.

The population phase optimizes for **coverage, recall, geographic breadth, and deduplication**. Business-owner claiming and verification are the later trust gate.

## Operating model

The marketplace population workflow is now:

**Discover -> deduplicate -> basic legitimacy check -> publish as unclaimed provisional listing -> enrich -> owner claims -> verify ownership -> owner confirms/corrects profile -> enable enquiries**

This replaces the previous verification-first workflow that required strong first-party evidence before publication.

## Minimum publication threshold

A provider may be published provisionally when all of the following are true:

1. The business/provider appears to be real and identifiable.
2. It is based in Zimbabwe or clearly serves Zimbabwe.
3. At least one wedding-relevant Wewed category is supported by public evidence.
4. At least one usable public source exists.
5. The candidate is not an obvious duplicate of an existing canonical provider.
6. No facts are fabricated.

An official website is no longer required.

Acceptable discovery evidence includes public Google Business/Maps results, public Facebook/Instagram/TikTok/X/LinkedIn business pages, wedding directories, expo/vendor lists, tourism and hospitality directories, professional associations, public company records, planner/vendor referrals, and official websites.

## Source tiers

### Tier A — first-party / strong
- Official business website
- Owner submission
- Official business social profile
- Public company or professional registry

### Tier B — useful discovery evidence
- Google Business / Maps
- Established wedding or business directory
- Tourism/hospitality directory
- Wedding expo/vendor list
- Association listing
- Public editorial/vendor feature

### Tier C — weak but usable lead
- Search-result evidence
- Secondary references
- Sparse directory records

Tier A and Tier B records can be provisionally published automatically when identity, Zimbabwe relevance, and category are clear. Tier C can be published when the core identity facts are still sufficiently clear; otherwise it remains an internal lead for enrichment.

## Confidence policy

- **80-100:** publish provisional automatically
- **65-79:** publish provisional automatically
- **50-64:** publish when identity + Zimbabwe connection + wedding category are clear
- **Below 50:** retain as lead until another source is found
- **Suspected fake or unresolved duplicate:** do not publish

Confidence describes discovery quality, not business verification.

## Claim and verification states

**Unclaimed** means Wewed assembled the listing from public business information. It is not owner-verified.

**Claimed** means an ownership claim has been submitted or accepted.

**Verified** means Wewed completed the applicable ownership/business verification process.

All discovery-created profiles must remain `acceptingEnquiries=false` until the claim-readiness rules are satisfied.

## Data integrity rules that remain strict

The relaxed source policy does **not** permit:

- fabricated businesses
- invented phone numbers, emails, addresses, prices, service areas, or categories
- copying protected portfolio/media without rights
- duplicate profiles for the same business
- private-data collection or login bypass
- representing an unclaimed profile as owner-verified

One real business must remain one canonical provider profile. Additional services are added as category offerings to that profile.

## Deduplication

Before creating a profile, compare candidates against the full Wewed provider corpus using as many of these identifiers as available:

- normalized business name
- website domain
- phone / WhatsApp
- public email
- Google Place ID
- Facebook URL
- Instagram handle
- TikTok handle
- X / LinkedIn / YouTube identity
- address / city / location
- name + city
- name + phone
- name + domain

Exact matches are suppressed. Probable matches are merged/reviewed. New category evidence for an existing business becomes another `ProviderServiceOffering`, not another provider profile.

## Geographic strategy

Search nationally rather than concentrating on Harare and Bulawayo. Use the Wewed Zimbabwe place catalogue and expand discovery across provincial capitals, secondary towns, tourism centres, border towns, district centres, growth points, and rural service catchments.

Each large wave should deliberately include underrepresented provinces and locations.

## Category strategy

Continue all 27 canonical Wewed categories, but allocate disproportionate discovery effort to thin categories such as:

- officiants
- choreography
- childcare
- content creation
- photo booths
- jewellery
- stationery
- gifts/favours
- florals
- beauty
- entertainment
- lighting/AV
- security
- bar/beverages
- attire
- transport

Do not manufacture category coverage. Category assignments must still be supported by public evidence.

## Batch strategy

Research should target **hundreds of candidates per discovery wave**. The database import path can process controlled chunks, with deduplication performed against the latest production corpus before every chunk.

Operational milestones:

1. 500 additional legitimate providers
2. 1,000 total providers
3. 5,000 total providers
4. 10,000 total providers
5. 20,000 total providers
6. 27,000 total legitimate unique provider profiles

The process should continue while legitimate new Zimbabwe-serving providers can be found. If the addressable market saturates below 27,000, Wewed must report the evidence-backed saturation point rather than create fake or duplicate records.

## Publication defaults for discovered providers

- `listingStatus = unclaimed`
- `isClaimable = true`
- `acceptingEnquiries = false`
- `visibility = published` when minimum publication threshold is met
- no owner confirmation date
- no copied portfolio/cover media unless explicitly licensed/authorised
- preserve source URLs, source type, collection time, confidence, and provenance
- expose claim, correction, and removal routes

## Success metrics

Track after every wave:

- unique provider profiles
- active public provisional profiles
- provider-category placements
- new profiles added
- duplicates suppressed
- candidates rejected
- profiles by province/city
- profiles by category
- profiles by source tier
- claim rate
- correction/removal rate
- owner-verification rate

## Principle

During population, **breadth first; verification on claim; accuracy and deduplication always**.
