# Graph Report - .  (2026-06-14)

## Corpus Check
- 36 files · ~314,119 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1085 nodes · 2732 edges · 57 communities
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 10 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]

## God Nodes (most connected - your core abstractions)
1. `escapeHtml()` - 95 edges
2. `buildPlayerCharacter()` - 33 edges
3. `applyPlayerLevelUp()` - 30 edges
4. `updatePlayerFormDerivedFields()` - 27 edges
5. `characterSheetMarkup()` - 27 edges
6. `bardLevelForPlayer()` - 23 edges
7. `abilityModifier()` - 23 edges
8. `uniqueTextList()` - 23 edges
9. `MapStorageService` - 23 edges
10. `getCampaign()` - 22 edges

## Surprising Connections (you probably didn't know these)
- `Beast Shape Compendium` --semantically_similar_to--> `Spell Compendium`  [INFERRED] [semantically similar]
  beast-shapes.html → spells.html
- `Wondrous Item Compendium` --semantically_similar_to--> `Beast Shape Compendium`  [INFERRED] [semantically similar]
  items.html → beast-shapes.html
- `Wondrous Item Compendium` --semantically_similar_to--> `Spell Compendium`  [INFERRED] [semantically similar]
  items.html → spells.html
- `Active Campaign Data Isolation` --conceptually_related_to--> `Campaign Dashboard`  [INFERRED]
  README.md → index.html
- `lineageLanguages()` --calls--> `add()`  [INFERRED]
  assets/script.js → test/campaign-flow.test.js

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Graphify Pipeline Components** — graphify_skill_graphify_pipeline, graphify_skill_structural_and_semantic_extraction, references_query_graph_traversal, references_update_incremental_graph_update, references_exports_graph_exports [EXTRACTED 1.00]
- **DnDucks Campaign Command Center** — index_campaign_dashboard, index_encounter_management, index_location_atlas, index_campaign_notes, index_character_ledger, index_homebrew_workbench, index_calendar_preview [EXTRACTED 1.00]
- **Searchable D&D Compendia** — beast_shapes_beast_shape_compendium, items_wondrous_item_compendium, spells_spell_compendium [INFERRED 0.85]
- **Regional Lake and Mountain Landscape** — maps_1780061832547_504ba237_8868_4a41_82ac_7c5cda4e4352_interconnected_lakes, maps_1780061832547_504ba237_8868_4a41_82ac_7c5cda4e4352_lakeside_settlement, maps_1780061832547_504ba237_8868_4a41_82ac_7c5cda4e4352_wooded_hills, maps_1780061832547_504ba237_8868_4a41_82ac_7c5cda4e4352_distant_mountains [INFERRED 0.85]

## Communities (57 total, 0 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.02
Nodes (59): ABILITIES, ARMOR_FORMULAS, ARTIFICER_SLOTS, BACKGROUND_PACKAGES, BARD_FEATURE_PROGRESSION, BARD_SUBCLASSES, BEAST_TRAIT_DESCRIPTIONS, beastTraitDescription() (+51 more)

### Community 1 - "Community 1"
Cohesion: 0.06
Nodes (72): abilityModifier(), abilityScore(), appendUniqueTextBlock(), applySuperiorInspiration(), attacksPerActionForPlayer(), backgroundFeatureBlockTitle(), bardArmorTrainingForPlayer(), bardBaseFeaturesForLevel() (+64 more)

### Community 2 - "Community 2"
Cohesion: 0.05
Nodes (55): applyDamageModifiers(), cancelWidgetEdit(), commaTags(), damageDiceFromStats(), damageTypeFromStats(), defaultWeatherWeights(), dexRuleFromArmorText(), entryTags() (+47 more)

### Community 3 - "Community 3"
Cohesion: 0.07
Nodes (50): addCombatantPanelMarkup(), assertLocalImageFitsStorage(), campaignStartContent(), canUseLocalImageFallback(), canvasToBlob(), combatantSources(), completeCampaignSetup(), createCampaign() (+42 more)

### Community 4 - "Community 4"
Cohesion: 0.07
Nodes (45): applyWildShapeOverlay(), beastShapeActions(), beastShapeActionsMarkup(), beastShapeCardMarkup(), beastShapeCollection(), beastShapeCrs(), beastShapeDetailRows(), beastShapeHasMovement() (+37 more)

### Community 5 - "Community 5"
Cohesion: 0.06
Nodes (32): {
  ALLOWED_CHARACTER_SUGGESTIONS,
  allAllowedSuggestionIds,
  backgroundSuggestionFromPayload,
  findAllowedSuggestion,
  upsertSuggestionInFile,
}, CHARACTER_ANALYSIS_RATE_LIMIT_MAX, CHARACTER_ANALYSIS_RATE_LIMIT_WINDOW_MS, characterAnalysisRateLimits, characterSuggestionSchema(), checkCharacterAnalysisRateLimit(), extractOpenAIOutputText(), extractOpenAIRefusal() (+24 more)

### Community 6 - "Community 6"
Cohesion: 0.07
Nodes (27): createServer(), ALLOWED_EXTENSIONS, ALLOWED_MIME_TYPES, assertSafeFilename(), cleanOptional(), crypto, fs, inferCategory() (+19 more)

### Community 7 - "Community 7"
Cohesion: 0.08
Nodes (19): ALLOWED_MAP_EXTENSIONS, ALLOWED_MAP_MIME_TYPES, clamp(), cleanText(), coordinateSet(), crypto, fs, MAP_STATUSES (+11 more)

### Community 8 - "Community 8"
Cohesion: 0.10
Nodes (34): activateCombatantDetail(), activeCombatant(), activeCombatantPanelMarkup(), armorClassForPlayer(), combatantAvatarMarkup(), combatantAvatarUrl(), combatantCardMarkup(), combatantConditionMarkup() (+26 more)

### Community 9 - "Community 9"
Cohesion: 0.08
Nodes (29): Campaign AI Assistant, DnDucks Product Vision, Static Prototype Strategy, Campaign Calendar, Custom Campaign Time System, Fantasy Weather Generation, Character Suggestion Dataset, Semicolon Tag Trigger Format (+21 more)

### Community 10 - "Community 10"
Cohesion: 0.17
Nodes (27): appendUniqueTextareaLines(), availableSpellsForClassLevels(), bardBonusSpellIds(), buildSpellcastingFromForm(), enforceSpellSelectionLimits(), levelUpSpellcastingForPlayer(), normalSpellSlotsForClassLevels(), playerSpellbookMarkup() (+19 more)

### Community 11 - "Community 11"
Cohesion: 0.12
Nodes (26): canonicalLocalOriginReachable(), canonicalLocalPath(), canonicalLocalUrl(), comicPageCardMarkup(), comicPageImageUrl(), configuredBackendBaseUrl(), formatBytes(), formatUploadedAt() (+18 more)

### Community 12 - "Community 12"
Cohesion: 0.11
Nodes (25): abilitySectionComplete(), armorClassFromEquipment(), armorFormulaFromEquipment(), backgroundNarrativeDescription(), bindPlayerSummaryControls(), equipmentHomebrewCardsMarkup(), equipmentHomebrewItemSummaries(), equipmentItems() (+17 more)

### Community 13 - "Community 13"
Cohesion: 0.13
Nodes (21): ALLOWED_CHARACTER_SUGGESTIONS, backgroundSuggestionFromPayload(), CHARACTER_SUGGESTION_CATEGORIES, CHARACTER_SUGGESTIONS_FILE, cleanCell(), findAllowedSuggestion(), fs, loadAllowedCharacterSuggestions() (+13 more)

### Community 14 - "Community 14"
Cohesion: 0.16
Nodes (22): abilityDeltasFromLevelUpOptions(), applyAbilityDeltasForLevelUp(), applyPlayerLevelUp(), buildPlayerCharacter(), classChoicesFromForm(), classFeatureProgressionLines(), classHitDiceFromClassLevels(), classLevelSummary() (+14 more)

### Community 15 - "Community 15"
Cohesion: 0.09
Nodes (22): backgroundMechanicsText(), backgroundStatistics(), backgroundStatList(), collectCharacterSuggestionPayload(), createCityNote(), createMapCity(), deleteCityNote(), deleteImage() (+14 more)

### Community 16 - "Community 16"
Cohesion: 0.14
Nodes (22): bardChoiceList(), bardChoicesForPlayer(), bardChoiceValidationErrors(), bardExpertiseRequiredCount(), bardFeatureChoicesMarkup(), bardLoreMagicalDiscoverySpells(), bardSpellChoiceId(), bardSpellChoiceIds() (+14 more)

### Community 17 - "Community 17"
Cohesion: 0.11
Nodes (21): Graph-First Repository Workflow, Existing Graph Fast Path, Graphify Pipeline, Honest Relationship Audit Trail, Structural and Semantic Extraction, Deferred Semantic Update for Non-Code Files, URL Ingestion and Folder Watch, Graph Export Formats (+13 more)

### Community 18 - "Community 18"
Cohesion: 0.13
Nodes (20): addCombatantToEncounter(), advanceCombatTurn(), bindCombatPageInteractions(), combatantIsTurnEligible(), getCombatEncounter(), initiativeTimelineMarkup(), moveCombatant(), moveCombatantBefore() (+12 more)

### Community 19 - "Community 19"
Cohesion: 0.14
Nodes (20): bootApp(), ensureEditCancelButton(), filteredWondrousItems(), importCanonicalLocalStoragePayload(), initAiPlaceholder(), initCommandInterface(), initDashboardForms(), initItemWeaponOptions() (+12 more)

### Community 20 - "Community 20"
Cohesion: 0.14
Nodes (19): classHitDice(), classInfo(), classLevelEntriesForPlayer(), classLevelEntriesFromParts(), classNameForValue(), derivedToolProficienciesForClass(), derivedToolProficienciesForClassLevels(), fixedLevelUpHitPoints() (+11 more)

### Community 21 - "Community 21"
Cohesion: 0.16
Nodes (16): abilityInputMarkup(), escapeHtml(), openWeaponPropertyOverlay(), openWondrousItemDetail(), renderCharacterSuggestions(), sheetField(), sheetSpellLevelGroupMarkup(), spellPickerLevelGroupMarkup() (+8 more)

### Community 22 - "Community 22"
Cohesion: 0.12
Nodes (16): comicLayoutById(), drawImageCover(), groupMediaByType(), imageUploadMarkup(), initComicsPage(), initImagePickers(), initMediaLibraryPage(), initMediaSelectPickers() (+8 more)

### Community 23 - "Community 23"
Cohesion: 0.12
Nodes (5): assert, fs, path, test, vm

### Community 24 - "Community 24"
Cohesion: 0.29
Nodes (3): cleanMetadataText(), cleanOptionalMetadataText(), ImageStorageService

### Community 25 - "Community 25"
Cohesion: 0.22
Nodes (14): abilityKeyForLabel(), abilityLabelForValue(), filterSpellPicker(), lineageExtraLanguageLimit(), lineageKey(), lineageLanguages(), lineagePackageForName(), lineageSpeed() (+6 more)

### Community 26 - "Community 26"
Cohesion: 0.20
Nodes (14): addToHiddenListField(), appendTextareaValue(), applyBackgroundPackageToForm(), applyCharacterSuggestion(), backgroundFeatureText(), backgroundPackageForName(), backgroundPackageFromSuggestion(), featDescriptionForName() (+6 more)

### Community 27 - "Community 27"
Cohesion: 0.20
Nodes (14): allowedSkillKeysForClass(), applyClassRestrictions(), applyLineagePackageToForm(), checkedFormValue(), classLevelEntriesFromForm(), enforceLanguageRestrictions(), enforceSkillLimit(), extraSkillChoiceLimitForForm() (+6 more)

### Community 28 - "Community 28"
Cohesion: 0.24
Nodes (14): bindCharacterSheetInteractions(), campaignDestinationHref(), campaignLibraryCardMarkup(), campaignReady(), campaignSetupHref(), campaignStartNoteHref(), campaignWidgetCounts(), dashboardHref() (+6 more)

### Community 29 - "Community 29"
Cohesion: 0.14
Nodes (13): description, devDependencies, vite, engines, node, main, name, scripts (+5 more)

### Community 30 - "Community 30"
Cohesion: 0.25
Nodes (14): encodeHeaderFilename(), handleCharacterAnalysisApi(), handleCharacterBackgroundSuggestionApi(), handleImageUploadsApi(), handleMapsApi(), handleMaterialsApi(), isPreviewable(), localCharacterSuggestions() (+6 more)

### Community 31 - "Community 31"
Cohesion: 0.16
Nodes (13): ALLOWED_IMAGE_EXTENSIONS, ALLOWED_IMAGE_MIME_TYPES, crypto, fs, IMAGE_UPLOAD_FIELD_NAMES, IMAGE_UPLOAD_MAX_BYTES, IMAGE_UPLOAD_MAX_FILES, imageExtensionFor() (+5 more)

### Community 32 - "Community 32"
Cohesion: 0.19
Nodes (13): applyBackgroundAbilityBonuses(), applyEvenBackgroundAbilityBoosts(), applyEvenLineageAbilityBoosts(), applySelectedBackgroundAbilityBoosts(), applySelectedLineageAbilityBoosts(), backgroundAbilityMechanicsText(), backgroundAbilityOptionMarkup(), renderBackgroundAbilityControls() (+5 more)

### Community 33 - "Community 33"
Cohesion: 0.39
Nodes (12): bardChoicesFromForm(), bardChoicesFromLevelUpForm(), bardLevelForClassLevels(), bardSubclassIdFromForm(), checkedFormValues(), classSubclassMapFromForm(), currentBardChoiceSelectionsFromForm(), formValue() (+4 more)

### Community 34 - "Community 34"
Cohesion: 0.18
Nodes (12): cityListMarkup(), cityNoteEditorMarkup(), cityNotesListMarkup(), cityPinFormMarkup(), getInteractiveMap(), initAppRoutes(), initCityDetailPage(), initMapDetailPage() (+4 more)

### Community 35 - "Community 35"
Cohesion: 0.20
Nodes (12): eventDateLabel(), eventTimeDisplay(), eventWeather(), getWeatherMap(), openEventDetail(), renderCollection(), renderDashboard(), renderDashboardOverview() (+4 more)

### Community 36 - "Community 36"
Cohesion: 0.27
Nodes (12): openSpellDetail(), sheetSpellCardMarkup(), spellCardMarkup(), spellClasses(), spellDetailMarkup(), spellDetailRows(), spellFeatureBadgesMarkup(), spellLevelLabel() (+4 more)

### Community 37 - "Community 37"
Cohesion: 0.36
Nodes (11): abilityBonusSummaryFromBonuses(), abilityScoresFromForm(), applyBackgroundBonusesToScores(), backgroundAbilityBonusesFromForm(), backgroundAbilityBonusSummary(), clearRolledHitPoints(), combineAbilityBonuses(), lineageAbilityBonusesFromForm() (+3 more)

### Community 38 - "Community 38"
Cohesion: 0.18
Nodes (11): displayText(), playerCharacterCard(), playerLevelUpHref(), textForSearch(), widgetDescriptionMarkup(), widgetDmAttribute(), widgetDmId(), widgetImageDisplayMarkup() (+3 more)

### Community 39 - "Community 39"
Cohesion: 0.27
Nodes (10): bardFeaturesUnlockedBetween(), bardSubclassById(), bardSubclassChoiceSummary(), bardSubclassFeaturesForPlayer(), bardSubclassRequiredForClassLevels(), bardSubclassValidationError(), levelUpPreviewMarkup(), levelUpSummaryCard() (+2 more)

### Community 40 - "Community 40"
Cohesion: 0.28
Nodes (9): bindPlayerLevelUpInteractions(), bindPlayerSpellbookInteractions(), cardVisualLabel(), levelUpAbilityInputsMarkup(), levelUpBardFeatureChoicesMarkup(), playerCharacterHref(), playerLevelUpMarkup(), renderPlayerLevelUpPage() (+1 more)

### Community 41 - "Community 41"
Cohesion: 0.25
Nodes (8): backgroundOptionNames(), bardSubclassSelectMarkup(), checkboxMarkup(), datalistMarkup(), equipmentOptionNames(), levelUpBardSubclassMarkup(), playerCharacterFormMarkup(), playerSpellcastingFormMarkup()

### Community 42 - "Community 42"
Cohesion: 0.29
Nodes (8): Beast Shape Compendium, D&D 5e Wiki on Fandom, DND 5th Edition Community Wiki, Estimated Rarity-Based Item Costs, Wondrous Item Compendium, DND 5th Edition Community Wiki Spell Lists, Generated Spell Summaries, Spell Compendium

### Community 43 - "Community 43"
Cohesion: 0.29
Nodes (7): applyBackgroundEquipmentChoice(), clearBackgroundSkillCheckboxes(), clearManagedBackgroundPackage(), removeFromHiddenListField(), removeTextareaBlock(), removeTextareaLines(), syncBackgroundEquipmentChoiceControls()

### Community 44 - "Community 44"
Cohesion: 0.40
Nodes (6): appendEquipmentItemsToSheet(), buyHomebrewItemFromShop(), commitEquipmentDraft(), equipmentShopMarkup(), homebrewShopItems(), renderEquipmentShop()

### Community 45 - "Community 45"
Cohesion: 0.33
Nodes (6): initMapFilePreview(), initMapsOverviewPage(), listInteractiveMaps(), loadMapsOverview(), mapUploadFormMarkup(), renderMapsOverviewPage()

### Community 46 - "Community 46"
Cohesion: 0.40
Nodes (5): bardPreparedSpellsAtLevel(), preparedSpellLabel(), preparedSpellLimitForEntry(), progressionValueAtLevel(), spellcastingGuidanceLine()

### Community 47 - "Community 47"
Cohesion: 0.40
Nodes (5): getDmOnlyTargets(), isDmOnlyTarget(), saveDmOnlyTargets(), setDmOnlyTarget(), toggleDmOnlyTarget()

### Community 48 - "Community 48"
Cohesion: 0.40
Nodes (5): mergeById(), mergeCampaignRecord(), mergeObjectStorageValues(), mergeStoredCollectionValues(), parseStoredJsonValue()

### Community 49 - "Community 49"
Cohesion: 0.50
Nodes (5): Distant Mountains, Interconnected Lakes, Lake District Panorama, Lakeside Settlement, Wooded Hills

### Community 50 - "Community 50"
Cohesion: 0.50
Nodes (4): BeastHpPanel(), TransformationEffectList(), WildShapeBanner(), WildShapeOverlay()

### Community 51 - "Community 51"
Cohesion: 0.50
Nodes (4): canCompressLocalImage(), compressedImageDataUrl(), fileToDataUrl(), imageToDataUrl()

### Community 52 - "Community 52"
Cohesion: 0.67
Nodes (3): backgroundEffectTags(), backgroundEquipmentParts(), gpFromText()

## Knowledge Gaps
- **127 isolated node(s):** `STORAGE_KEYS`, `USER_WIDGET_COLLECTIONS`, `WIDGET_FORM_LABELS`, `DEFAULT_CAMPAIGN`, `PLAYER_CLASSES` (+122 more)
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `add()` connect `Community 25` to `Community 23`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **Why does `MapStorageService` connect `Community 7` to `Community 5`, `Community 6`?**
  _High betweenness centrality (0.007) - this node is a cross-community bridge._
- **Why does `lineageLanguages()` connect `Community 25` to `Community 0`?**
  _High betweenness centrality (0.006) - this node is a cross-community bridge._
- **What connects `STORAGE_KEYS`, `USER_WIDGET_COLLECTIONS`, `WIDGET_FORM_LABELS` to the rest of the system?**
  _141 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.02276632302405498 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.060641627543035995 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.05454545454545454 - nodes in this community are weakly interconnected._