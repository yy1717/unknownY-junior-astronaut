import * as Phaser from 'phaser';

import {
    fetchRecentSEPEvents,
    fetchTrainingSEPEvent
} from '../nasa';

type Planet = 'Moon' | 'Mars';

type PlanetProgress = {
    solarLevel: number;
    eclssLevel: number;
    greenhouseLevel: number;

    science: number;

    bestStars: number;
    missionsCompleted: number;
};

type SaveData = {
    version: 1;

    Moon: PlanetProgress;
    Mars: PlanetProgress;
};

type KnowledgeId =
    | 'habitat'
    | 'eclss'
    | 'solar'
    | 'greenhouse'
    | 'communication'
    | 'radiation'
    | 'sep'
    | 'donki'
    | 'moon-shadow'
    | 'mars-dust'
    | 'water'
    | 'isru';

type KnowledgeCard = {
    id: KnowledgeId;
    title: string;
    lines: string[];
};

type LibraryCategoryId =
    | 'space-weather'
    | 'life-support'
    | 'moon'
    | 'mars'
    | 'space-resources'
    | 'mission-safety';

type LibraryArticle = {
    title: string;
    lines: string[];
};

type LibraryCategory = {
    id: LibraryCategoryId;
    title: string;
    articles: LibraryArticle[];
};

export class Game extends Phaser.Scene
{
    private readonly headingFont =
        '"VT323", "Courier New", monospace';

    private readonly bodyFont =
        '"VT323", "Courier New", monospace';

    private readonly hudWidth = 340;
    private readonly uiGap = 20;
    private readonly worldLeft = 30;
    private readonly worldTop = 225;
    private readonly worldBottom = 670;

    private get worldRight()
    {
        return this.scale.width -
            this.hudWidth -
            this.uiGap;
    }

    private get worldCenterX()
    {
        return (this.worldLeft + this.worldRight) / 2;
    }

    private readonly uiColors = {
        panel: 0x142536,
        panelDark: 0x0b1520,
        border: 0x63c7e8,
        accent: 0xffd166,
        success: 0x69d58c,
        warning: 0xffc857,
        danger: 0xff6b6b,
        disabled: 0x64717d,
        text: '#f4f7fa',
        mutedText: '#b9c7d3'
    } as const;

    // =====================================================
    // SAVE STATE
    // =====================================================

    private readonly saveKey =
        'unknownY_outpost_save_v1';

    private readonly codexSaveKey =
        'unknownY_space_codex_v1';

    private saveData!: SaveData;
    private unlockedKnowledge = new Set<KnowledgeId>();

    // =====================================================
    // GAME FLOW
    // =====================================================

    private selectedPlanet: Planet | null = null;
    private gameStarted = false;

    private tutorialStep = 0;
    private tutorialComplete = false;

    private radiationScenarioScheduled = false;

    // =====================================================
    // WORLD OBJECTS
    // =====================================================

    private player!: Phaser.GameObjects.Image;
    private playerShadow!: Phaser.GameObjects.Rectangle;
    private habitat!: Phaser.GameObjects.Rectangle;
    private shelter!: Phaser.GameObjects.Rectangle;
    private solarArray!: Phaser.GameObjects.Rectangle;
    private greenhouse!: Phaser.GameObjects.Rectangle;
    private commStation!: Phaser.GameObjects.Rectangle;
    private spaceLab!: Phaser.GameObjects.Rectangle;

    // =====================================================
    // CONTROLS
    // =====================================================

    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;

    private wasd!: {
        W: Phaser.Input.Keyboard.Key;
        A: Phaser.Input.Keyboard.Key;
        S: Phaser.Input.Keyboard.Key;
        D: Phaser.Input.Keyboard.Key;
    };

    private interactKey!: Phaser.Input.Keyboard.Key;
    private lifeSupportKey!: Phaser.Input.Keyboard.Key;
    private learnKey!: Phaser.Input.Keyboard.Key;
    private closePanelKey!: Phaser.Input.Keyboard.Key;
    private codexKey!: Phaser.Input.Keyboard.Key;

    private readonly touchCapable =
        typeof window !== 'undefined' &&
        (
            'ontouchstart' in window ||
            navigator.maxTouchPoints > 0
        );

    private touchUp = false;
    private touchDown = false;
    private touchLeft = false;
    private touchRight = false;

    private touchUseRequested = false;
    private touchLearnRequested = false;
    private touchEclssRequested = false;
    private touchNotesRequested = false;

    private touchControlObjects: Phaser.GameObjects.GameObject[] = [];

    // =====================================================
    // UI
    // =====================================================

    private interactionText!: Phaser.GameObjects.Text;
    private statusText!: Phaser.GameObjects.Text;
    private hudText!: Phaser.GameObjects.Text;
    private hudGraphics!: Phaser.GameObjects.Graphics;
    private hudBarLabels: Phaser.GameObjects.Text[] = [];
    private hudSecondaryText!: Phaser.GameObjects.Text;
    private hudResearchText!: Phaser.GameObjects.Text;
    private hudCodexText!: Phaser.GameObjects.Text;
    private spaceWeatherText!: Phaser.GameObjects.Text;
    private emergencyText!: Phaser.GameObjects.Text;

    private tutorialText!: Phaser.GameObjects.Text;
    private objectiveMarker!: Phaser.GameObjects.Text;

    private readingPanelOpen = false;
    private readingPanelObjects: Phaser.GameObjects.GameObject[] = [];

    // =====================================================
    // GAME STATE
    // =====================================================

    private power = 80;

    private lifeSupport = 85;
    private oxygen = 85;
    private water = 80;
    private co2 = 15;

    private eclssActive = false;

    private radiation = 10;
    private science = 0;

    private lifeSupportTimer?: Phaser.Time.TimerEvent;
    private lastLifeSupportWarning = '';

    private solarReady = true;
    private powerSystemStarted = false;
    private lowPowerWarningShown = false;

    private food = 70;
    private crewHealth = 100;

    private greenhouseGrowing = false;
    private greenhouseProgress = 0;

    private foodSystemStarted = false;
    private foodWarningShown = false;

    private communicationPending = false;

    // =====================================================
    // ENVIRONMENT STATE
    // =====================================================

    private moonShadowActive = false;
    private marsDustActive = false;

    private environmentEventTriggered = false;

    // =====================================================
    // PROGRESSION STATE
    // =====================================================

    private solarLevel = 1;
    private eclssLevel = 1;
    private greenhouseLevel = 1;

    private upgradeMenuOpen = false;
    private pendingNextCycle = 1;

    private upgradeOneKey!: Phaser.Input.Keyboard.Key;
    private upgradeTwoKey!: Phaser.Input.Keyboard.Key;
    private upgradeThreeKey!: Phaser.Input.Keyboard.Key;
    private skipUpgradeKey!: Phaser.Input.Keyboard.Key;

    private upgradePanel?: Phaser.GameObjects.Rectangle;
    private upgradeText?: Phaser.GameObjects.Text;
    private upgradeFeedbackText?: Phaser.GameObjects.Text;
    private upgradeTemporaryObjects: Phaser.GameObjects.GameObject[] = [];

    // =====================================================
    // MISSION STATE
    // =====================================================

    private missionLoopStarted = false;
    private missionEnded = false;

    private missionCycle = 1;
    private maxMissionCycles = 3;

    private missionTimeRemaining = 45;
    private missionCycleDuration = 45;

    private missionTimer?: Phaser.Time.TimerEvent;

    private totalHarvests = 0;
    private totalEarthMessages = 0;
    private successfulShelters = 0;

    // =====================================================
    // NASA EVENT
    // =====================================================

    private trainingEvent: any = null;

    private radiationEmergencyActive = false;
    private radiationTimer?: Phaser.Time.TimerEvent;

    constructor()
    {
        super('Game');
    }

    // =====================================================
    // START
    // =====================================================

    create()
    {
        this.resetRuntimeState();
        this.resetTouchInput();

        this.saveData =
            this.loadSaveData();

        this.unlockedKnowledge =
            this.loadKnowledgeProgress();

        this.cameras.main.setBackgroundColor('#080a10');

        const stars = this.add.graphics();

        for (let i = 0; i < 32; i += 1)
        {
            stars.fillStyle(0xbad8e8, 0.45);
            stars.fillRect(
                (i * 109 + 17) % this.scale.width,
                (i * 61 + 23) % this.scale.height,
                i % 8 === 0 ? 2 : 1,
                i % 8 === 0 ? 2 : 1
            );
        }

        this.showStartScreen();
    }

    update(_: number, delta: number)
    {
        // Do not run gameplay logic
        // before the mission begins.

        if (!this.gameStarted)
        {
            return;
        }

        if (
            this.readingPanelOpen &&
            Phaser.Input.Keyboard.JustDown(
                this.closePanelKey
            )
        )
        {
            this.closeReadingPanel();

            return;
        }

        if (this.readingPanelOpen)
        {
            return;
        }

        const touchNotesPressed =
            this.consumeTouchNotes();

        if (
            Phaser.Input.Keyboard.JustDown(
                this.codexKey
            ) ||
            touchNotesPressed
        )
        {
            this.showCodexPanel();

            return;
        }

        if (this.missionEnded)
        {
            return;
        }

        // Research Break: player frozen,
        // only upgrade input is handled.

        if (this.upgradeMenuOpen)
        {
            this.handleUpgradeInput();

            return;
        }

        const touchUsePressed =
            this.consumeTouchUse();
        const touchLearnPressed =
            this.consumeTouchLearn();
        const touchEclssPressed =
            this.consumeTouchEclss();

        const usePressed =
            Phaser.Input.Keyboard.JustDown(
                this.interactKey
            ) ||
            touchUsePressed;

        const learnPressed =
            Phaser.Input.Keyboard.JustDown(
                this.learnKey
            ) ||
            touchLearnPressed;

        const eclssPressed =
            Phaser.Input.Keyboard.JustDown(
                this.lifeSupportKey
            ) ||
            touchEclssPressed;

        // =================================================
        // MOVEMENT
        // =================================================

        const speed = 250;
        const movement = speed * (delta / 1000);

        let dx = 0;
        let dy = 0;

        if (
            this.cursors.left.isDown ||
            this.wasd.A.isDown ||
            this.touchLeft
        )
        {
            dx -= 1;
        }

        if (
            this.cursors.right.isDown ||
            this.wasd.D.isDown ||
            this.touchRight
        )
        {
            dx += 1;
        }

        if (
            this.cursors.up.isDown ||
            this.wasd.W.isDown ||
            this.touchUp
        )
        {
            dy -= 1;
        }

        if (
            this.cursors.down.isDown ||
            this.wasd.S.isDown ||
            this.touchDown
        )
        {
            dy += 1;
        }

        if (dx !== 0 && dy !== 0)
        {
            dx *= 0.7071;
            dy *= 0.7071;
        }

        this.player.x += dx * movement;
        this.player.y += dy * movement;

        this.player.x = Phaser.Math.Clamp(
            this.player.x,
            this.worldLeft + 20,
            this.worldRight - 20
        );

        this.player.y = Phaser.Math.Clamp(
            this.player.y,
            this.worldTop + 20,
            this.worldBottom - 20
        );

        this.playerShadow.setPosition(
            this.player.x + 3,
            this.player.y + 12
        );

        // =================================================
        // DISTANCE CHECKS
        // =================================================

        const habitatDistance =
            Phaser.Math.Distance.Between(
                this.player.x,
                this.player.y,
                this.habitat.x,
                this.habitat.y
            );

        const shelterDistance =
            Phaser.Math.Distance.Between(
                this.player.x,
                this.player.y,
                this.shelter.x,
                this.shelter.y
            );

        const solarDistance =
            Phaser.Math.Distance.Between(
                this.player.x,
                this.player.y,
                this.solarArray.x,
                this.solarArray.y
            );

        const greenhouseDistance =
            Phaser.Math.Distance.Between(
                this.player.x,
                this.player.y,
                this.greenhouse.x,
                this.greenhouse.y
            );

        const commDistance =
            Phaser.Math.Distance.Between(
                this.player.x,
                this.player.y,
                this.commStation.x,
                this.commStation.y
            );

        const spaceLabDistance =
            Phaser.Math.Distance.Between(
                this.player.x,
                this.player.y,
                this.spaceLab.x,
                this.spaceLab.y
            );

        // =================================================
        // PICK THE NEAREST BUILDING IN RANGE
        // =================================================
        // If the player is close to more than one building,
        // only the nearest one is interactive.

        const candidates = [
            { name: 'space-lab',  distance: spaceLabDistance,  range: 120 },
            { name: 'comm',       distance: commDistance,       range: 120 },
            { name: 'greenhouse', distance: greenhouseDistance, range: 120 },
            { name: 'solar',      distance: solarDistance,      range: 120 },
            { name: 'shelter',    distance: shelterDistance,    range: 120 },
            { name: 'habitat',    distance: habitatDistance,    range: 110 }
        ]
        .filter(c => c.distance < c.range)
        .sort((a, b) => a.distance - b.distance);

        const target =
            candidates.length > 0
                ? candidates[0].name
                : null;

        // =================================================
        // SPACE LAB
        // =================================================

        if (target === 'space-lab')
        {
            this.interactionText.setText(
                '[E] OPEN SPACE LIBRARY\n[L] QUICK LEARN'
            );

            if (usePressed)
            {
                this.showSpaceLibrary();
            }

            if (learnPressed)
            {
                this.showSpaceLibraryArticle(
                    'space-weather',
                    0
                );
            }

            return;
        }

        // =================================================
        // COMMUNICATION STATION
        // =================================================

        if (target === 'comm')
        {
            if (this.communicationPending)
            {
                this.interactionText.setText(
                    'EARTH REPLY PENDING   •   [L] LEARN'
                );
            }
            else
            {
                this.interactionText.setText(
                    '[E] CONTACT EARTH   •   [L] LEARN'
                );
            }

            if (usePressed)
            {
                this.requestEarthGuidance();
            }

            if (learnPressed)
            {
                this.showLearnPanel('communication');
            }

            return;
        }

        // =================================================
        // GREENHOUSE
        // =================================================

        if (target === 'greenhouse')
        {
            if (this.greenhouseGrowing)
            {
                this.interactionText.setText(
                    `CROP GROWING ${this.greenhouseProgress}/3   •   [L] LEARN`
                );
            }
            else
            {
                this.interactionText.setText(
                    '[E] START CROP   •   [L] LEARN'
                );
            }

            if (usePressed)
            {
                this.useGreenhouse();
            }

            if (learnPressed)
            {
                this.showLearnPanel('greenhouse');
            }

            return;
        }

        // =================================================
        // SOLAR ARRAY
        // =================================================

        if (target === 'solar')
        {
            if (this.solarReady)
            {
                this.interactionText.setText(
                    '[E] CHARGE BATTERY   •   [L] LEARN'
                );
            }
            else
            {
                this.interactionText.setText(
                    'SOLAR PANELS CHARGING   •   [L] LEARN'
                );
            }

            if (usePressed)
            {
                this.useSolarArray();
            }

            if (learnPressed)
            {
                this.showLearnPanel('solar');
            }

            return;
        }

        // =================================================
        // RADIATION SHELTER
        // =================================================

        if (target === 'shelter')
        {
            if (this.radiationEmergencyActive)
            {
                this.interactionText.setText(
                    '[E] ENTER RADIATION SHELTER'
                );

                if (usePressed)
                {
                    this.enterRadiationShelter();
                }
            }
            else
            {
                this.interactionText.setText(
                    '[E] INSPECT SHELTER   •   [L] LEARN'
                );

                if (usePressed)
                {
                    this.showShelterInfo();
                }

                if (learnPressed)
                {
                    this.showLearnPanel('shelter');
                }
            }

            return;
        }

        // =================================================
        // HABITAT
        // =================================================

        if (target === 'habitat')
        {
            this.interactionText.setText(
                '[E] INSPECT   •   [R] ECLSS   •   [L] LEARN'
            );

            if (usePressed)
            {
                this.showHabitatInfo();
            }

            if (eclssPressed)
            {
                this.toggleECLSS();
            }

            if (learnPressed)
            {
                this.showLearnPanel('habitat');
            }

            return;
        }

        this.interactionText.setText('');
    }

    // =====================================================
    // PIXEL UI DESIGN SYSTEM
    // =====================================================

    private createPixelPanel(
        x: number,
        y: number,
        width: number,
        height: number,
        accent: number = this.uiColors.border,
        depth = 1
    )
    {
        this.add.rectangle(
            x + 6,
            y + 7,
            width,
            height,
            0x02060a,
            0.65
        )
        .setDepth(depth - 1);

        return this.add.rectangle(
            x,
            y,
            width,
            height,
            this.uiColors.panel,
            1
        )
        .setStrokeStyle(4, accent)
        .setDepth(depth);
    }

    private createPixelButton(
        x: number,
        y: number,
        width: number,
        label: string,
        action: () => void,
        accent: number = this.uiColors.border,
        depth = 2
    )
    {
        const shadow =
            this.add.rectangle(
                x + 4,
                y + 5,
                width,
                68,
                0x02060a,
                0.8
            )
            .setDepth(depth - 1);

        const button =
            this.add.rectangle(
                x,
                y,
                width,
                68,
                this.uiColors.panelDark,
                1
            )
            .setStrokeStyle(3, accent)
            .setDepth(depth)
            .setInteractive({ useHandCursor: true });

        const text =
            this.add.text(
                x,
                y,
                label,
                {
                    fontFamily: this.headingFont,
                    fontSize: '31px',
                    color: this.uiColors.text,
                    align: 'center'
                }
            )
            .setOrigin(0.5)
            .setDepth(depth + 1);

        button.on('pointerover', () =>
        {
            button.setFillStyle(accent, 0.28);
            text.setColor('#ffffff');
        });

        button.on('pointerout', () =>
        {
            button.setFillStyle(this.uiColors.panelDark, 1);
        });

        button.on('pointerdown', action);

        return { button, text, shadow };
    }

    private drawPixelPlanet(
        x: number,
        y: number,
        planet: Planet,
        depth = 2
    )
    {
        const graphics =
            this.add.graphics()
                .setDepth(depth);

        const base =
            planet === 'Moon'
                ? 0xaab1bb
                : 0xc96545;

        const shadow =
            planet === 'Moon'
                ? 0x59616c
                : 0x713526;

        graphics.fillStyle(shadow, 1);
        graphics.fillRect(x - 34, y - 28, 68, 56);
        graphics.fillRect(x - 26, y - 36, 52, 72);

        graphics.fillStyle(base, 1);
        graphics.fillRect(x - 28, y - 28, 48, 56);
        graphics.fillRect(x - 20, y - 34, 38, 68);

        graphics.fillStyle(shadow, 0.75);
        graphics.fillRect(x - 17, y - 18, 12, 8);
        graphics.fillRect(x + 5, y + 4, 15, 10);
        graphics.fillRect(x - 11, y + 18, 9, 6);

        graphics.fillStyle(
            planet === 'Moon'
                ? 0xdce1e6
                : 0xe99a68,
            1
        );
        graphics.fillRect(x - 19, y - 27, 18, 5);
        graphics.fillRect(x + 4, y - 13, 10, 4);
    }

    // =====================================================
    // SCREEN 0 — START
    // =====================================================

    private showStartScreen()
    {
        this.children.removeAll(true);

        this.selectedPlanet = null;
        this.gameStarted = false;
        this.cameras.main.setBackgroundColor('#050914');
        this.createPixelTextures();

        const space =
            this.add.graphics();

        for (let i = 0; i < 58; i += 1)
        {
            const x = (i * 97 + 31) % this.scale.width;
            const y = (i * 53 + 19) % this.scale.height;
            const size = i % 9 === 0 ? 3 : 1;

            space.fillStyle(
                i % 6 === 0
                    ? 0x63c7e8
                    : 0xdde9f2,
                i % 4 === 0 ? 0.9 : 0.55
            );
            space.fillRect(x, y, size, size);
        }

        this.drawPixelPlanet(170, 185, 'Moon', 1);
        this.drawPixelPlanet(1190, 570, 'Mars', 1);

        this.add.text(
            this.scale.width / 2,
            160,
            'unknownY',
            {
                fontFamily: this.headingFont,
                fontSize: '70px',
                color: '#ffffff',
                stroke: '#24435c',
                strokeThickness: 8
            }
        )
        .setOrigin(0.5);

        this.add.text(
            this.scale.width / 2,
            240,
            'JUNIOR ASTRONAUT MISSION TRAINER',
            {
                fontFamily: this.headingFont,
                fontSize: '34px',
                color: '#8fdcff'
            }
        )
        .setOrigin(0.5);

        this.add.image(
            this.scale.width / 2,
            355,
            'pixel-astronaut'
        )
        .setScale(2.2);

        let started = false;

        const continueToSelection = () =>
        {
            if (started)
            {
                return;
            }

            started = true;
            this.showPlanetSelection();
        };

        this.createPixelButton(
            this.scale.width / 2,
            485,
            350,
            'START MISSION',
            continueToSelection,
            this.uiColors.accent
        );

        this.add.text(
            this.scale.width / 2,
            555,
            'Learn. Explore. Survive.',
            {
                fontFamily: this.bodyFont,
                fontSize: '29px',
                color: this.uiColors.mutedText
            }
        )
        .setOrigin(0.5);

        this.add.text(
            this.scale.width / 2,
            615,
            'TAP START OR PRESS ENTER',
            {
                fontFamily: this.bodyFont,
                fontSize: '22px',
                color: '#728698'
            }
        )
        .setOrigin(0.5);

        const enterKey =
            this.input.keyboard!.addKey(
                Phaser.Input.Keyboard.KeyCodes.ENTER
            );

        enterKey.once('down', continueToSelection);
    }

    // =====================================================
    // SCREEN 1 — PLANET SELECTION
    // =====================================================

    private showPlanetSelection()
    {
        this.children.removeAll(true);

        this.selectedPlanet = null;
        this.gameStarted = false;

        this.cameras.main.setBackgroundColor('#080a10');

        this.add.text(
            this.scale.width / 2,
            38,
            'CHOOSE YOUR DESTINATION',
            {
                fontFamily: this.headingFont,
                fontSize: '42px',
                color: '#ffffff'
            }
        )
        .setOrigin(0.5);

        this.add.text(
            this.scale.width / 2,
            100,
            'TWO WORLDS • TWO BIG ADVENTURES',
            {
                fontFamily: this.bodyFont,
                fontSize: '25px',
                color: '#8fdcff'
            }
        )
        .setOrigin(0.5);

        this.add.text(
            this.scale.width / 2,
            145,
            'Pick a planet for your next mission.',
            {
                fontFamily: this.bodyFont,
                fontSize: '24px',
                color: '#cccccc',
                align: 'center'
            }
        )
        .setOrigin(0.5);

        const moonProgress =
            this.saveData.Moon;

        const marsProgress =
            this.saveData.Mars;

        // =================================================
        // MOON BUTTON
        // =================================================

        const moonButton =
            this.add.rectangle(
                this.scale.width / 2 - 260,
                380,
                450,
                410,
                0x202d3b
            )
            .setStrokeStyle(
                4,
                0xd7dce5
            )
            .setInteractive({
                useHandCursor: true
            });

        this.drawPixelPlanet(
            moonButton.x,
            moonButton.y - 80,
            'Moon',
            2
        );

        this.add.text(
            moonButton.x,
            moonButton.y - 22,
            'MOON',
            {
                fontFamily: this.headingFont,
                fontSize: '34px',
                color: '#ffffff'
            }
        )
        .setOrigin(0.5);

        this.add.text(
            moonButton.x,
            moonButton.y + 28,
            'Close to Earth',
            {
                fontFamily: this.bodyFont,
                fontSize: '24px',
                color: '#d7dce5',
                align: 'center'
            }
        )
        .setOrigin(0.5);

        this.add.text(
            moonButton.x,
            moonButton.y + 72,
            'Shadow & radiation challenges',
            {
                fontFamily: this.bodyFont,
                fontSize: '22px',
                color: '#d7dce5'
            }
        )
        .setOrigin(0.5);

        this.add.text(
            moonButton.x,
            moonButton.y + 124,
            [
                `BEST  ${this.getStarDisplay(moonProgress.bestStars)}`,
                `MISSIONS  ${moonProgress.missionsCompleted}`
            ],
            {
                fontFamily: this.bodyFont,
                fontSize: '22px',
                color: '#d7dce5',
                align: 'center',
                lineSpacing: 5
            }
        )
        .setOrigin(0.5);

        this.add.text(
            moonButton.x,
            moonButton.y + 184,
            '[1] SELECT MOON',
            {
                fontFamily: this.headingFont,
                fontSize: '24px',
                color: '#ffffff'
            }
        )
        .setOrigin(0.5);

        // =================================================
        // MARS BUTTON
        // =================================================

        const marsButton =
            this.add.rectangle(
                this.scale.width / 2 + 260,
                380,
                450,
                410,
                0x43251f
            )
            .setStrokeStyle(
                4,
                0xf17c67
            )
            .setInteractive({
                useHandCursor: true
            });

        this.drawPixelPlanet(
            marsButton.x,
            marsButton.y - 80,
            'Mars',
            2
        );

        this.add.text(
            marsButton.x,
            marsButton.y - 22,
            'MARS',
            {
                fontFamily: this.headingFont,
                fontSize: '34px',
                color: '#ff947d'
            }
        )
        .setOrigin(0.5);

        this.add.text(
            marsButton.x,
            marsButton.y + 28,
            'Far from Earth',
            {
                fontFamily: this.bodyFont,
                fontSize: '24px',
                color: '#ffc0b3',
                align: 'center'
            }
        )
        .setOrigin(0.5);

        this.add.text(
            marsButton.x,
            marsButton.y + 72,
            'Dust & communication challenges',
            {
                fontFamily: this.bodyFont,
                fontSize: '22px',
                color: '#ffc0b3'
            }
        )
        .setOrigin(0.5);

        this.add.text(
            marsButton.x,
            marsButton.y + 124,
            [
                `BEST  ${this.getStarDisplay(marsProgress.bestStars)}`,
                `MISSIONS  ${marsProgress.missionsCompleted}`
            ],
            {
                fontFamily: this.bodyFont,
                fontSize: '22px',
                color: '#ffc0b3',
                align: 'center',
                lineSpacing: 5
            }
        )
        .setOrigin(0.5);

        this.add.text(
            marsButton.x,
            marsButton.y + 184,
            '[2] SELECT MARS',
            {
                fontFamily: this.headingFont,
                fontSize: '24px',
                color: '#ffdfd8'
            }
        )
        .setOrigin(0.5);

        // =================================================
        // CLICK EVENTS
        // =================================================

        moonButton.on(
            'pointerover',
            () =>
            {
                moonButton
                    .setFillStyle(0x334a60)
                    .setStrokeStyle(6, 0xffffff);
            }
        );

        moonButton.on(
            'pointerout',
            () =>
            {
                moonButton
                    .setFillStyle(0x202d3b)
                    .setStrokeStyle(4, 0xd7dce5);
            }
        );

        marsButton.on(
            'pointerover',
            () =>
            {
                marsButton
                    .setFillStyle(0x66372c)
                    .setStrokeStyle(6, 0xffb09d);
            }
        );

        marsButton.on(
            'pointerout',
            () =>
            {
                marsButton
                    .setFillStyle(0x43251f)
                    .setStrokeStyle(4, 0xf17c67);
            }
        );

        moonButton.on(
            'pointerdown',
            () =>
            {
                this.selectPlanet('Moon');
            }
        );

        marsButton.on(
            'pointerdown',
            () =>
            {
                this.selectPlanet('Mars');
            }
        );

        // Keyboard shortcuts

        const moonKey =
            this.input.keyboard!.addKey(
                Phaser.Input.Keyboard.KeyCodes.ONE
            );

        const marsKey =
            this.input.keyboard!.addKey(
                Phaser.Input.Keyboard.KeyCodes.TWO
            );

        moonKey.once(
            'down',
            () =>
            {
                this.selectPlanet('Moon');
            }
        );

        marsKey.once(
            'down',
            () =>
            {
                this.selectPlanet('Mars');
            }
        );

        this.add.text(
            this.scale.width / 2,
            625,
            'Click a card or use the number keys.',
            {
                fontFamily: this.bodyFont,
                fontSize: '21px',
                color: '#8294a3'
            }
        )
        .setOrigin(0.5);
    }

    // =====================================================
    // PLANET CHOSEN
    // =====================================================

    private selectPlanet(planet: Planet)
    {
        if (this.selectedPlanet !== null)
        {
            return;
        }

        this.selectedPlanet = planet;

        this.showMissionRules();
    }

    // =====================================================
    // SCREEN 2 — GAME RULES
    // =====================================================

    private showMissionRules()
    {
        if (!this.selectedPlanet)
        {
            return;
        }

        this.children.removeAll(true);

        const isMoon =
            this.selectedPlanet === 'Moon';

        const accent =
            isMoon
                ? '#dfe6f1'
                : '#ff947d';

        this.cameras.main.setBackgroundColor(
            isMoon
                ? '#0d1017'
                : '#170c0a'
        );

        // =================================================
        // TITLE
        // =================================================

        this.add.text(
            this.scale.width / 2,
            55,
            `${this.selectedPlanet.toUpperCase()} MISSION`,
            {
                fontFamily: this.headingFont,
                fontSize: '46px',
                color: accent
            }
        )
        .setOrigin(0.5);

        this.add.text(
            this.scale.width / 2,
            82,
            'MISSION BRIEFING',
            {
                fontFamily: this.headingFont,
                fontSize: '32px',
                color: '#ffffff'
            }
        )
        .setOrigin(0.5);

        this.createPixelPanel(
            230,
            330,
            380,
            430,
            this.uiColors.border,
            0
        );

        this.createPixelPanel(
            640,
            330,
            400,
            430,
            this.uiColors.success,
            0
        );

        this.createPixelPanel(
            1095,
            330,
            450,
            430,
            isMoon
                ? 0xdfe6f1
                : 0xf17c67,
            0
        );

        this.createPixelPanel(
            this.scale.width / 2,
            590,
            this.scale.width - 80,
            66,
            this.uiColors.border,
            0
        );

        // =================================================
        // GOAL
        // =================================================

        this.add.text(
            60,
            138,
            'YOUR MISSION',
            {
                fontFamily: this.headingFont,
                fontSize: '30px',
                color: '#8fdcff'
            }
        );

        this.add.text(
            60,
            184,
            [
                'KEEP THE CREW SAFE',
                'Protect your astronauts.',
                '',
                'MANAGE RESOURCES',
                'Balance power, air, water and food.',
                '',
                'COMPLETE SCIENCE GOALS',
                'Learn how a real outpost works.'
            ],
            {
                fontFamily: this.bodyFont,
                fontSize: '23px',
                color: '#ffffff',
                lineSpacing: 8
            }
        );

        // =================================================
        // SYSTEM EXPLANATIONS
        // =================================================

        this.add.text(
            460,
            138,
            'YOUR BASE SYSTEMS',
            {
                fontFamily: this.headingFont,
                fontSize: '30px',
                color: '#8fdcff'
            }
        );

        this.add.text(
            460,
            184,
            [
                'POWER',
                'Keeps machines running.',
                '',
                'LIFE SUPPORT',
                'Keeps air and water safe.',
                '',
                'RADIATION',
                'Watch space-weather danger.',
                '',
                'FOOD & COMMUNICATION',
                'Grow crops and contact Earth.'
            ],
            {
                fontFamily: this.bodyFont,
                fontSize: '22px',
                color: '#dddddd',
                lineSpacing: 3
            }
        );

        // =================================================
        // PLANET-SPECIFIC INFORMATION
        // =================================================

        this.add.text(
            895,
            138,
            `${this.selectedPlanet.toUpperCase()} CONDITIONS`,
            {
                fontFamily: this.headingFont,
                fontSize: '30px',
                color: accent
            }
        );

        const planetRules =
            isMoon
                ? [
                    'CLOSE TO EARTH',
                    'Messages arrive quickly.',
                    '',
                    'SOLAR POWER & SHADOW',
                    'Panels work well in sunlight.',
                    'Local shadow stops charging.',
                    '',
                    'RADIATION',
                    'The Moon has little protection.',
                    '',
                    'TIP',
                    'Store Battery power early.'
                ]
                : [
                    'FAR FROM EARTH',
                    'Messages take much longer.',
                    '',
                    'WEAKER SOLAR & DUST',
                    'Dust can reduce charging.',
                    '',
                    'LIFE SUPPORT',
                    'Plan air, water, food and energy.',
                    '',
                    'TIP',
                    'Act before Earth can reply.'
                ];

        this.add.text(
            895,
            184,
            planetRules,
            {
                fontFamily: this.bodyFont,
                fontSize: '22px',
                color: '#ffffff',
                lineSpacing: 3
            }
        );

        // =================================================
        // CONTROLS
        // =================================================

        this.add.text(
            60,
            574,
            'CONTROLS',
            {
                fontFamily: this.headingFont,
                fontSize: '28px',
                color: '#8fdcff'
            }
        );

        this.add.text(
            265,
            576,
            'KEYBOARD OR TOUCH     MOVE • USE • LEARN • ECLSS',
            {
                fontFamily: this.bodyFont,
                fontSize: '22px',
                color: '#dddddd',
                lineSpacing: 3
            }
        );

        // =================================================
        // START BUTTON
        // =================================================

        const startButton =
            this.add.rectangle(
                this.scale.width / 2,
                690,
                390,
                66,
                0x1e4d63
            )
            .setStrokeStyle(
                3,
                0x8fdcff
            )
            .setInteractive({
                useHandCursor: true
            });

        this.add.text(
            startButton.x,
            startButton.y,
            'BEGIN MISSION',
            {
                fontFamily: this.headingFont,
                fontSize: '31px',
                color: '#ffffff'
            }
        )
        .setOrigin(0.5);

        startButton.on(
            'pointerdown',
            () =>
            {
                this.startMission();
            }
        );

        const enterKey =
            this.input.keyboard!.addKey(
                Phaser.Input.Keyboard.KeyCodes.ENTER
            );

        enterKey.once(
            'down',
            () =>
            {
                this.startMission();
            }
        );
    }

    // =====================================================
    // START MISSION
    // =====================================================

    private startMission()
    {
        if (
            !this.selectedPlanet ||
            this.gameStarted
        )
        {
            return;
        }

        this.gameStarted = true;
        this.resetTouchInput();

        this.loadPlanetProgress();

        this.children.removeAll(true);

        this.buildOutpost();
        this.setupControls();
        this.createHUD();
        this.createTouchControls();

        // NASA calls only begin once
        // the actual mission starts.

        this.loadNASAData();
        this.loadTrainingScenario();

        this.startTutorial();
    }

    // =====================================================
    // BUILD OUTPOST
    // =====================================================

    private buildOutpost()
    {
        if (!this.selectedPlanet)
        {
            return;
        }

        const isMoon =
            this.selectedPlanet === 'Moon';

        this.cameras.main.setBackgroundColor(
            isMoon
                ? '#070914'
                : '#100706'
        );

        this.createPixelTextures();
        this.createSpaceBackdrop(isMoon);

        // =================================================
        // HEADER
        // =================================================

        this.add.text(
            24,
            18,
            `unknownY // ${this.selectedPlanet} Outpost`,
            {
                fontFamily: this.headingFont,
                fontSize: '32px',
                color: '#ffffff'
            }
        )
        .setDepth(5);

        this.add.text(
            24,
            58,
            'KEYBOARD OR TOUCH: MOVE   •   USE   •   LEARN   •   SPACE NOTES',
            {
                fontFamily: this.bodyFont,
                fontSize: '20px',
                color: '#aaaaaa'
            }
        )
        .setDepth(5);

        // =================================================
        // NASA LIVE STATUS
        // =================================================

        this.spaceWeatherText =
            this.add.text(
                24,
                92,
                'NASA Space Weather: Connecting...',
                {
                    fontFamily: this.bodyFont,
                    fontSize: '21px',
                    color: '#ffd966',
                    backgroundColor: '#181a20',

                    padding: {
                        x: 14,
                        y: 8
                    },

                    wordWrap: {
                        width: 520,
                        useAdvancedWrap: true
                    }
                }
            )
            .setDepth(5);

        // =================================================
        // EMERGENCY OBJECTIVE
        // =================================================

        this.emergencyText =
            this.add.text(
                this.worldCenterX,
                192,
                '',
                {
                    fontFamily: this.headingFont,
                    fontSize: '22px',
                    color: '#ff6b6b',
                    backgroundColor: '#200d10',

                    padding: {
                        x: 16,
                        y: 10
                    },

                    align: 'center',
                    lineSpacing: 3,

                    wordWrap: {
                        width: 720,
                        useAdvancedWrap: true
                    }
                }
            )
            .setOrigin(0.5)
            .setDepth(30)
            .setVisible(false);

        // =================================================
        // TEMPORARY SURFACE
        // =================================================

        this.add.rectangle(
            this.worldCenterX,
            (this.worldTop + this.worldBottom) / 2,
            this.worldRight - this.worldLeft,
            this.worldBottom - this.worldTop,

            isMoon
                ? 0x555b66
                : 0x8a4934
        )
        .setStrokeStyle(
            4,
            isMoon
                ? 0x7a818c
                : 0xc47752
        )
        .setDepth(-20);

        this.createGroundDetails(isMoon);

        // =================================================
        // PLAYER
        // =================================================

        this.playerShadow =
            this.add.rectangle(
                this.worldCenterX - 97,
                (this.worldTop + this.worldBottom) / 2 + 12,
                22,
                8,
                0x101218,
                0.55
            )
            .setDepth(3);

        this.player =
            this.add.image(
                this.worldCenterX - 100,
                (this.worldTop + this.worldBottom) / 2,
                'pixel-astronaut'
            )
            .setDepth(4);

        // =================================================
        // HABITAT
        // =================================================

        this.habitat =
            this.add.rectangle(
                this.worldCenterX + 170,
                this.scale.height / 2 - 65,
                120,
                100,
                0xe8e8e8
            )
            .setStrokeStyle(
                4,
                0x999999
            )
            .setAlpha(0);

        this.add.rectangle(
            this.habitat.x + 5,
            this.habitat.y + 8,
            118,
            72,
            0x11141b,
            0.5
        )
        .setDepth(-1);

        this.add.image(
            this.habitat.x,
            this.habitat.y,
            'pixel-habitat'
        )
        .setDepth(1);

        this.add.text(
            this.habitat.x,
            this.habitat.y + 58,
            'HABITAT',
            {
                fontFamily: this.bodyFont,
                fontSize: '21px',
                color: '#ffffff',
                backgroundColor: '#101218',
                align: 'center',
                padding: {
                    x: 5,
                    y: 3
                }
            }
        )
        .setOrigin(0.5)
        .setDepth(2);

        // =================================================
        // SOLAR ARRAY
        // =================================================

        this.solarArray =
            this.add.rectangle(
                this.worldCenterX - 80,
                this.scale.height / 2 + 170,
                170,
                85,
                0x29465b
            )
            .setStrokeStyle(
                4,
                0x6ecbff
            )
            .setAlpha(0);

        this.add.rectangle(
            this.solarArray.x + 5,
            this.solarArray.y + 8,
            166,
            66,
            0x11141b,
            0.5
        )
        .setDepth(-1);

        this.add.image(
            this.solarArray.x,
            this.solarArray.y,
            'pixel-solar-array'
        )
        .setDepth(1);

        this.add.text(
            this.solarArray.x,
            this.solarArray.y + 53,
            'SOLAR ARRAY',
            {
                fontFamily: this.bodyFont,
                fontSize: '21px',
                color: '#ffffff',
                backgroundColor: '#101218',
                align: 'center',
                padding: {
                    x: 5,
                    y: 3
                }
            }
        )
        .setOrigin(0.5)
        .setDepth(2);

        // =================================================
        // RADIATION SHELTER
        // =================================================

        this.shelter =
            this.add.rectangle(
                this.worldCenterX + 220,
                this.scale.height / 2 + 150,
                150,
                100,
                0x56363c
            )
            .setStrokeStyle(
                4,
                0xff6b6b
            )
            .setAlpha(0);

        this.add.rectangle(
            this.shelter.x + 6,
            this.shelter.y + 9,
            146,
            76,
            0x11141b,
            0.6
        )
        .setDepth(-1);

        this.add.image(
            this.shelter.x,
            this.shelter.y,
            'pixel-shelter'
        )
        .setDepth(1);

        this.add.text(
            this.shelter.x,
            this.shelter.y + 62,
            'RADIATION SHELTER',
            {
                fontFamily: this.bodyFont,
                fontSize: '21px',
                color: '#ffffff',
                backgroundColor: '#101218',
                align: 'center',
                padding: {
                    x: 5,
                    y: 3
                }
            }
        )
        .setOrigin(0.5)
        .setDepth(2);

        // =================================================
        // GREENHOUSE
        // =================================================

        this.greenhouse =
            this.add.rectangle(
                this.worldCenterX - 300,
                this.scale.height / 2 + 155,
                165,
                100,
                0x29452f
            )
            .setStrokeStyle(
                4,
                0x78d98b
            )
            .setAlpha(0);

        this.add.rectangle(
            this.greenhouse.x + 5,
            this.greenhouse.y + 9,
            158,
            74,
            0x11141b,
            0.5
        )
        .setDepth(-1);

        this.add.image(
            this.greenhouse.x,
            this.greenhouse.y,
            'pixel-greenhouse'
        )
        .setDepth(1);

        this.add.text(
            this.greenhouse.x,
            this.greenhouse.y + 61,
            'GREENHOUSE',
            {
                fontFamily: this.bodyFont,
                fontSize: '21px',
                color: '#ffffff',
                backgroundColor: '#101218',
                align: 'center',
                padding: {
                    x: 5,
                    y: 3
                }
            }
        )
        .setOrigin(0.5)
        .setDepth(2);

        // =================================================
        // COMMUNICATION STATION
        // =================================================

        this.commStation =
            this.add.rectangle(
                this.worldCenterX - 180,
                this.scale.height / 2 - 110,
                175,
                90,
                0x2f304f
            )
            .setStrokeStyle(
                4,
                0x9e9cff
            )
            .setAlpha(0);

        this.add.rectangle(
            this.commStation.x + 5,
            this.commStation.y + 8,
            166,
            70,
            0x11141b,
            0.5
        )
        .setDepth(-1);

        this.add.image(
            this.commStation.x,
            this.commStation.y,
            'pixel-comm-station'
        )
        .setDepth(1);

        this.add.text(
            this.commStation.x,
            this.commStation.y + 57,
            'COMM STATION',
            {
                fontFamily: this.bodyFont,
                fontSize: '21px',
                color: '#ffffff',
                backgroundColor: '#101218',
                align: 'center',
                padding: {
                    x: 5,
                    y: 3
                }
            }
        )
        .setOrigin(0.5)
        .setDepth(2);

        // =================================================
        // SPACE LAB
        // =================================================

        this.spaceLab =
            this.add.rectangle(
                this.worldRight - 125,
                this.scale.height / 2 - 15,
                170,
                105,
                0x223a4b
            )
            .setStrokeStyle(4, 0x66ddff)
            .setAlpha(0);

        this.add.rectangle(
            this.spaceLab.x + 5,
            this.spaceLab.y + 8,
            166,
            82,
            0x11141b,
            0.55
        )
        .setDepth(-1);

        this.add.image(
            this.spaceLab.x,
            this.spaceLab.y,
            'pixel-space-lab'
        )
        .setDepth(1);

        this.add.text(
            this.spaceLab.x,
            this.spaceLab.y + 64,
            'SPACE LAB',
            {
                fontFamily: this.bodyFont,
                fontSize: '21px',
                color: '#ffffff',
                backgroundColor: '#101218',
                align: 'center',
                padding: {
                    x: 7,
                    y: 3
                }
            }
        )
        .setOrigin(0.5)
        .setDepth(2);
    }

    // =====================================================
    // PROCEDURAL PIXEL ART
    // =====================================================

    private createPixelTextures()
    {
        this.createAstronautTexture();
        this.createHabitatTexture();
        this.createSolarArrayTexture();
        this.createGreenhouseTexture();
        this.createCommStationTexture();
        this.createShelterTexture();
        this.createSpaceLabTexture();
    }

    private generatePixelTexture(
        key: string,
        width: number,
        height: number,
        draw: (graphics: Phaser.GameObjects.Graphics) => void
    )
    {
        if (this.textures.exists(key))
        {
            return;
        }

        const graphics =
            this.make.graphics({
                x: 0,
                y: 0
            });

        draw(graphics);
        graphics.generateTexture(key, width, height);
        graphics.destroy();
    }

    private createAstronautTexture()
    {
        this.generatePixelTexture(
            'pixel-astronaut',
            28,
            32,
            graphics =>
            {
                const dark = 0x18202c;
                const suitShadow = 0xaab3bd;
                const suit = 0xe9edf0;

                graphics.fillStyle(dark);
                graphics.fillRect(5, 2, 18, 12);
                graphics.fillRect(4, 10, 20, 15);
                graphics.fillRect(7, 24, 6, 7);
                graphics.fillRect(16, 24, 6, 7);

                graphics.fillStyle(0x69727d);
                graphics.fillRect(2, 10, 5, 14);

                graphics.fillStyle(suitShadow);
                graphics.fillRect(7, 3, 14, 10);
                graphics.fillRect(7, 13, 15, 12);
                graphics.fillRect(2, 14, 5, 8);
                graphics.fillRect(22, 14, 4, 8);

                graphics.fillStyle(suit);
                graphics.fillRect(9, 3, 11, 3);
                graphics.fillRect(9, 14, 11, 9);
                graphics.fillRect(8, 24, 4, 6);
                graphics.fillRect(17, 24, 4, 6);

                graphics.fillStyle(0x172638);
                graphics.fillRect(8, 6, 13, 6);
                graphics.fillStyle(0x385f78);
                graphics.fillRect(10, 7, 8, 2);

                graphics.fillStyle(0xe0584f);
                graphics.fillRect(9, 16, 3, 3);
                graphics.fillStyle(0x66ddff);
                graphics.fillRect(17, 16, 2, 2);
            }
        );
    }

    private createHabitatTexture()
    {
        this.generatePixelTexture(
            'pixel-habitat',
            128,
            96,
            graphics =>
            {
                graphics.fillStyle(0x3b424c);
                graphics.fillRect(8, 28, 112, 52);
                graphics.fillRect(18, 18, 92, 10);

                graphics.fillStyle(0xb8c0c8);
                graphics.fillRect(10, 24, 108, 48);
                graphics.fillStyle(0xe5e8e8);
                graphics.fillRect(18, 18, 92, 46);
                graphics.fillStyle(0x8f99a4);
                graphics.fillRect(18, 62, 92, 10);

                graphics.fillStyle(0x263442);
                graphics.fillRect(51, 42, 26, 30);
                graphics.fillStyle(0x111a22);
                graphics.fillRect(56, 47, 16, 25);

                graphics.fillStyle(0x66c8e8);
                graphics.fillRect(26, 31, 14, 10);
                graphics.fillRect(88, 31, 14, 10);
                graphics.fillStyle(0xcff7ff);
                graphics.fillRect(28, 32, 8, 2);
                graphics.fillRect(90, 32, 8, 2);

                graphics.fillStyle(0xd9574f);
                graphics.fillRect(18, 50, 24, 5);
                graphics.fillStyle(0x6f7882);
                graphics.fillRect(13, 72, 14, 8);
                graphics.fillRect(101, 72, 14, 8);
                graphics.fillRect(104, 10, 4, 14);
                graphics.fillStyle(0xffd166);
                graphics.fillRect(103, 8, 6, 4);
            }
        );
    }

    private createSolarArrayTexture()
    {
        this.generatePixelTexture(
            'pixel-solar-array',
            176,
            90,
            graphics =>
            {
                graphics.fillStyle(0x6e7781);
                graphics.fillRect(82, 12, 12, 66);
                graphics.fillRect(62, 72, 52, 7);

                for (const panelX of [6, 48, 92, 134])
                {
                    graphics.fillStyle(0x111d32);
                    graphics.fillRect(panelX, 18, 36, 48);
                    graphics.fillStyle(0x244d73);
                    graphics.fillRect(panelX + 3, 21, 30, 42);

                    graphics.fillStyle(0x5da4c7);
                    graphics.fillRect(panelX + 17, 21, 2, 42);
                    graphics.fillRect(panelX + 3, 34, 30, 2);
                    graphics.fillRect(panelX + 3, 48, 30, 2);
                    graphics.fillStyle(0x9dd8e8);
                    graphics.fillRect(panelX + 5, 23, 10, 3);
                }

                graphics.fillStyle(0xadb5bd);
                graphics.fillRect(79, 36, 18, 20);
                graphics.fillStyle(0x424a54);
                graphics.fillRect(83, 40, 10, 12);
            }
        );
    }

    private createGreenhouseTexture()
    {
        this.generatePixelTexture(
            'pixel-greenhouse',
            168,
            104,
            graphics =>
            {
                graphics.fillStyle(0x3f4850);
                graphics.fillRect(8, 42, 152, 46);
                graphics.fillStyle(0x87b9b1);
                graphics.fillRect(14, 28, 140, 54);
                graphics.fillStyle(0xbce3d7);
                graphics.fillRect(22, 20, 124, 54);
                graphics.fillStyle(0x5f8f86);
                graphics.fillRect(22, 68, 124, 10);

                graphics.fillStyle(0x59646b);
                graphics.fillRect(48, 20, 5, 58);
                graphics.fillRect(82, 20, 5, 58);
                graphics.fillRect(116, 20, 5, 58);
                graphics.fillRect(20, 42, 128, 4);

                graphics.fillStyle(0x275b36);
                graphics.fillRect(29, 53, 17, 13);
                graphics.fillRect(62, 49, 19, 17);
                graphics.fillRect(96, 52, 18, 14);
                graphics.fillRect(128, 48, 12, 18);
                graphics.fillStyle(0x78c95c);
                graphics.fillRect(33, 48, 8, 10);
                graphics.fillRect(67, 44, 9, 11);
                graphics.fillRect(101, 47, 8, 11);
                graphics.fillRect(129, 44, 9, 10);

                graphics.fillStyle(0xd8f4ed);
                graphics.fillRect(29, 25, 34, 4);
                graphics.fillStyle(0x77828a);
                graphics.fillRect(4, 62, 10, 18);
                graphics.fillRect(154, 62, 10, 18);
            }
        );
    }

    private createCommStationTexture()
    {
        this.generatePixelTexture(
            'pixel-comm-station',
            176,
            100,
            graphics =>
            {
                graphics.fillStyle(0x434c59);
                graphics.fillRect(12, 58, 152, 28);
                graphics.fillStyle(0x778391);
                graphics.fillRect(20, 50, 136, 30);
                graphics.fillStyle(0x252d38);
                graphics.fillRect(30, 58, 42, 22);

                graphics.fillStyle(0xb8c2ca);
                graphics.fillRect(92, 22, 8, 42);
                graphics.fillRect(98, 24, 28, 6);
                graphics.fillRect(104, 30, 30, 6);
                graphics.fillRect(110, 36, 28, 6);
                graphics.fillRect(116, 42, 18, 6);
                graphics.fillStyle(0x596673);
                graphics.fillRect(96, 42, 8, 16);
                graphics.fillRect(88, 58, 24, 8);

                graphics.fillStyle(0x66ddff);
                graphics.fillRect(38, 63, 6, 5);
                graphics.fillStyle(0x7dff9a);
                graphics.fillRect(49, 63, 6, 5);
                graphics.fillStyle(0xffd166);
                graphics.fillRect(60, 63, 6, 5);

                graphics.fillStyle(0x9e9cff);
                graphics.fillRect(139, 16, 4, 42);
                graphics.fillRect(136, 14, 10, 4);
            }
        );
    }

    private createShelterTexture()
    {
        this.generatePixelTexture(
            'pixel-shelter',
            156,
            104,
            graphics =>
            {
                graphics.fillStyle(0x242a31);
                graphics.fillRect(4, 34, 148, 58);
                graphics.fillStyle(0x4c535b);
                graphics.fillRect(10, 26, 136, 58);
                graphics.fillStyle(0x69717a);
                graphics.fillRect(18, 18, 120, 58);
                graphics.fillStyle(0x353b43);
                graphics.fillRect(26, 68, 104, 16);

                graphics.fillStyle(0x171b20);
                graphics.fillRect(57, 44, 42, 40);
                graphics.fillStyle(0x555d66);
                graphics.fillRect(64, 49, 28, 35);
                graphics.fillStyle(0xffc857);
                graphics.fillRect(72, 58, 12, 5);
                graphics.fillRect(76, 54, 4, 13);

                graphics.fillStyle(0xb84b4b);
                graphics.fillRect(18, 30, 28, 8);
                graphics.fillRect(110, 30, 28, 8);
                graphics.fillStyle(0x8e969e);
                graphics.fillRect(8, 76, 140, 8);
                graphics.fillRect(14, 20, 8, 64);
                graphics.fillRect(134, 20, 8, 64);
            }
        );
    }

    private createSpaceLabTexture()
    {
        this.generatePixelTexture(
            'pixel-space-lab',
            176,
            110,
            graphics =>
            {
                graphics.fillStyle(0x303b47);
                graphics.fillRect(8, 42, 160, 54);
                graphics.fillStyle(0x71808d);
                graphics.fillRect(16, 34, 144, 54);
                graphics.fillStyle(0xb8c6cf);
                graphics.fillRect(24, 28, 128, 52);

                graphics.fillStyle(0x162331);
                graphics.fillRect(38, 42, 38, 24);
                graphics.fillRect(100, 42, 38, 24);
                graphics.fillStyle(0x66ddff);
                graphics.fillRect(43, 47, 28, 14);
                graphics.fillStyle(0x9e9cff);
                graphics.fillRect(105, 47, 28, 14);
                graphics.fillStyle(0xffd166);
                graphics.fillRect(48, 50, 8, 3);
                graphics.fillRect(112, 54, 14, 3);

                graphics.fillStyle(0x596673);
                graphics.fillRect(84, 8, 6, 31);
                graphics.fillRect(69, 10, 34, 5);
                graphics.fillStyle(0xdceaf3);
                graphics.fillRect(64, 6, 14, 8);
                graphics.fillStyle(0x66ddff);
                graphics.fillRect(87, 4, 7, 7);

                graphics.fillStyle(0x27333e);
                graphics.fillRect(79, 58, 18, 30);
                graphics.fillStyle(0x8fdcff);
                graphics.fillRect(84, 63, 8, 5);
            }
        );
    }

    private createSpaceBackdrop(isMoon: boolean)
    {
        const stars =
            this.add.graphics()
                .setDepth(-40);

        for (let i = 0; i < 48; i += 1)
        {
            const x =
                (i * 83 + 29) % this.scale.width;

            const y =
                (i * 47 + 13) % this.scale.height;

            const size =
                i % 7 === 0
                    ? 2
                    : 1;

            stars.fillStyle(
                i % 5 === 0
                    ? 0x8fc9e8
                    : 0xd8e6ef,
                i % 4 === 0
                    ? 0.9
                    : 0.55
            );
            stars.fillRect(x, y, size, size);
        }

        if (isMoon)
        {
            stars.fillStyle(0x3f6f9d, 1);
            stars.fillRect(674, 54, 18, 12);
            stars.fillStyle(0x77a8cf, 1);
            stars.fillRect(670, 58, 26, 8);
            stars.fillStyle(0xdceaf3, 1);
            stars.fillRect(677, 52, 11, 4);
        }
        else
        {
            stars.fillStyle(0xffd27a, 0.9);
            stars.fillRect(680, 56, 10, 10);
            stars.fillStyle(0xff9b52, 0.45);
            stars.fillRect(676, 52, 18, 18);
        }
    }

    private createGroundDetails(isMoon: boolean)
    {
        const details =
            this.add.graphics()
                .setDepth(-19);

        const craterPositions = [
            [118, 262],
            [864, 270],
            [890, 640],
            [122, 638],
            [570, 626],
            [886, 390],
            [170, 355]
        ];

        for (const [x, y] of craterPositions)
        {
            details.fillStyle(
                isMoon
                    ? 0x30343d
                    : 0x653326,
                0.75
            );
            details.fillRect(x - 13, y - 5, 26, 12);

            details.fillStyle(
                isMoon
                    ? 0x444a54
                    : 0x7a3d2c,
                1
            );
            details.fillRect(x - 9, y - 7, 18, 12);

            details.fillStyle(
                isMoon
                    ? 0x686f7a
                    : 0xa95b3e,
                0.8
            );
            details.fillRect(x - 8, y - 7, 10, 3);
        }

        for (let i = 0; i < 30; i += 1)
        {
            const x = 72 + ((i * 137) % 860);
            const y =
                this.worldTop + 18 +
                (
                    (i * 89) %
                    (this.worldBottom - this.worldTop - 36)
                );

            details.fillStyle(
                isMoon
                    ? (i % 2 === 0 ? 0x747b85 : 0x3d424a)
                    : (i % 2 === 0 ? 0xb76643 : 0x603025),
                0.8
            );
            details.fillRect(
                x,
                y,
                i % 3 === 0 ? 6 : 3,
                i % 4 === 0 ? 4 : 2
            );
        }

        if (!isMoon)
        {
            details.fillStyle(0xd18a60, 0.35);
            details.fillRect(76, 252, 96, 7);
            details.fillRect(790, 310, 118, 8);
            details.fillRect(480, 646, 126, 6);
        }

        // Small scientific equipment near the perimeter.
        details.fillStyle(0x28313b, 0.8);
        details.fillRect(78, 420, 34, 22);
        details.fillStyle(0xaab3bd, 1);
        details.fillRect(82, 414, 26, 22);
        details.fillStyle(0xffc857, 1);
        details.fillRect(82, 423, 26, 4);

        details.fillStyle(0x555f68, 1);
        details.fillRect(914, 270, 5, 30);
        details.fillRect(906, 298, 21, 5);
        details.fillStyle(0xe05d55, 1);
        details.fillRect(912, 264, 9, 7);
    }

    // =====================================================
    // CONTROLS
    // =====================================================

    private setupControls()
    {
        this.cursors =
            this.input.keyboard!.createCursorKeys();

        this.wasd =
            this.input.keyboard!.addKeys({

                W: Phaser.Input.Keyboard.KeyCodes.W,
                A: Phaser.Input.Keyboard.KeyCodes.A,
                S: Phaser.Input.Keyboard.KeyCodes.S,
                D: Phaser.Input.Keyboard.KeyCodes.D

            }) as typeof this.wasd;

        this.interactKey =
            this.input.keyboard!.addKey(
                Phaser.Input.Keyboard.KeyCodes.E
            );

        this.lifeSupportKey =
            this.input.keyboard!.addKey(
                Phaser.Input.Keyboard.KeyCodes.R
            );

        this.learnKey =
            this.input.keyboard!.addKey(
                Phaser.Input.Keyboard.KeyCodes.L
            );

        this.closePanelKey =
            this.input.keyboard!.addKey(
                Phaser.Input.Keyboard.KeyCodes.ESC
            );

        this.codexKey =
            this.input.keyboard!.addKey(
                Phaser.Input.Keyboard.KeyCodes.K
            );

        // Research Break keys
        // (logic prototype only — final UI will use
        // clickable upgrade cards)

        this.upgradeOneKey =
            this.input.keyboard!.addKey(
                Phaser.Input.Keyboard.KeyCodes.ONE
            );

        this.upgradeTwoKey =
            this.input.keyboard!.addKey(
                Phaser.Input.Keyboard.KeyCodes.TWO
            );

        this.upgradeThreeKey =
            this.input.keyboard!.addKey(
                Phaser.Input.Keyboard.KeyCodes.THREE
            );

        this.skipUpgradeKey =
            this.input.keyboard!.addKey(
                Phaser.Input.Keyboard.KeyCodes.C
            );
    }

    private resetTouchInput()
    {
        this.touchUp = false;
        this.touchDown = false;
        this.touchLeft = false;
        this.touchRight = false;

        this.touchUseRequested = false;
        this.touchLearnRequested = false;
        this.touchEclssRequested = false;
        this.touchNotesRequested = false;
    }

    private consumeTouchUse()
    {
        const requested = this.touchUseRequested;
        this.touchUseRequested = false;

        return requested;
    }

    private consumeTouchLearn()
    {
        const requested = this.touchLearnRequested;
        this.touchLearnRequested = false;

        return requested;
    }

    private consumeTouchEclss()
    {
        const requested = this.touchEclssRequested;
        this.touchEclssRequested = false;

        return requested;
    }

    private consumeTouchNotes()
    {
        const requested = this.touchNotesRequested;
        this.touchNotesRequested = false;

        return requested;
    }

    private createTouchControls()
    {
        if (!this.touchCapable)
        {
            return;
        }

        const dpadX = this.worldLeft + 58;
        const dpadY = this.worldBottom - 100;
        const dpadOffset = 46;

        this.createTouchHoldButton(
            dpadX,
            dpadY - dpadOffset,
            'UP',
            () => { this.touchUp = true; },
            () => { this.touchUp = false; }
        );

        this.createTouchHoldButton(
            dpadX,
            dpadY + dpadOffset,
            'DOWN',
            () => { this.touchDown = true; },
            () => { this.touchDown = false; }
        );

        this.createTouchHoldButton(
            dpadX - dpadOffset,
            dpadY,
            'LEFT',
            () => { this.touchLeft = true; },
            () => { this.touchLeft = false; }
        );

        this.createTouchHoldButton(
            dpadX + dpadOffset,
            dpadY,
            'RIGHT',
            () => { this.touchRight = true; },
            () => { this.touchRight = false; }
        );

        const actionLeft = this.worldRight - 142;
        const actionRight = this.worldRight - 50;

        this.createTouchActionButton(
            actionLeft,
            this.worldBottom - 130,
            'USE',
            () => { this.touchUseRequested = true; },
            0xffd166
        );

        this.createTouchActionButton(
            actionRight,
            this.worldBottom - 130,
            'LEARN',
            () => { this.touchLearnRequested = true; },
            0x66ddff
        );

        this.createTouchActionButton(
            actionLeft,
            this.worldBottom - 70,
            'ECLSS',
            () => { this.touchEclssRequested = true; },
            0x69d58c
        );

        this.createTouchActionButton(
            actionRight,
            this.worldBottom - 70,
            'NOTES',
            () => { this.touchNotesRequested = true; },
            0x9e9cff
        );
    }

    private createTouchHoldButton(
        x: number,
        y: number,
        label: string,
        press: () => void,
        release: () => void
    )
    {
        const button = this.createTouchButton(
            x,
            y,
            56,
            56,
            label,
            0x66ddff
        );

        const releaseButton = () =>
        {
            release();
            button.setFillStyle(0x142536, 0.78);
        };

        button
            .on('pointerdown', () =>
            {
                press();
                button.setFillStyle(0x31566d, 0.92);
            })
            .on('pointerup', releaseButton)
            .on('pointerout', releaseButton)
            .on('pointerupoutside', releaseButton);
    }

    private createTouchActionButton(
        x: number,
        y: number,
        label: string,
        action: () => void,
        accent: number
    )
    {
        const button = this.createTouchButton(
            x,
            y,
            86,
            52,
            label,
            accent
        );

        button.on('pointerdown', action);
    }

    private createTouchButton(
        x: number,
        y: number,
        width: number,
        height: number,
        label: string,
        accent: number
    )
    {
        const button =
            this.add.rectangle(
                x,
                y,
                width,
                height,
                0x142536,
                0.78
            )
            .setStrokeStyle(3, accent, 0.9)
            .setDepth(25)
            .setInteractive({ useHandCursor: true });

        const text =
            this.add.text(
                x,
                y,
                label,
                {
                    fontFamily: this.headingFont,
                    fontSize: '20px',
                    color: '#ffffff',
                    align: 'center'
                }
            )
            .setOrigin(0.5)
            .setDepth(26);

        this.touchControlObjects.push(button, text);

        return button;
    }

    // =====================================================
    // HUD
    // =====================================================

    private createHUD()
    {
        const hudRightMargin = 16;
        const hudLeft =
            this.worldRight + this.uiGap;
        const hudWidth =
            this.scale.width - hudLeft - hudRightMargin;

        const objectiveWidth =
            this.worldRight - this.worldLeft - 40;
        const objectiveCenterX =
            this.worldCenterX;

        const bottomCenterX =
            this.worldCenterX;

        const bottomTextWidth =
            this.worldRight - this.worldLeft - 50;

        this.createPixelPanel(
            hudLeft + hudWidth / 2,
            this.scale.height / 2,
            hudWidth,
            this.scale.height - 32,
            this.uiColors.border,
            9
        );

        this.hudText =
            this.add.text(
                hudLeft + 22,
                30,
                '',
                {
                    fontFamily: this.headingFont,
                    fontSize: '28px',
                    color: this.uiColors.text,
                    lineSpacing: 4
                }
            )
            .setDepth(11);

        this.hudGraphics =
            this.add.graphics()
                .setDepth(11);

        this.hudBarLabels = [];

        for (let i = 0; i < 5; i += 1)
        {
            this.hudBarLabels.push(
                this.add.text(
                    hudLeft + 26,
                    112 + i * 58,
                    '',
                    {
                        fontFamily: this.bodyFont,
                        fontSize: '21px',
                        color: this.uiColors.text
                    }
                )
                .setDepth(12)
            );
        }

        this.hudSecondaryText =
            this.add.text(
                hudLeft + 26,
                395,
                '',
                {
                    fontFamily: this.bodyFont,
                    fontSize: '20px',
                    color: this.uiColors.mutedText,
                    lineSpacing: 1
                }
            )
            .setDepth(12);

        this.hudResearchText =
            this.add.text(
                hudLeft + 26,
                584,
                '',
                {
                    fontFamily: this.bodyFont,
                    fontSize: '20px',
                    color: '#ffe39a',
                    lineSpacing: 1
                }
            )
            .setDepth(12);

        this.interactionText =
            this.add.text(
                bottomCenterX,
                this.scale.height - 28,
                '',
                {
                    fontFamily: this.headingFont,
                    fontSize: '24px',
                    color: '#ffffff',
                    backgroundColor: '#102334',

                    padding: {
                        x: 20,
                        y: 10
                    },

                    align: 'center',
                    wordWrap: {
                        width: bottomTextWidth,
                        useAdvancedWrap: true
                    }
                }
            )
            .setOrigin(0.5)
            .setDepth(12);

        this.tutorialText =
            this.add.text(
                objectiveCenterX,
                174,
                '',
                {
                    fontFamily: this.bodyFont,
                    fontSize: '24px',
                    color: '#ffffff',
                    backgroundColor: '#173044',

                    padding: {
                        x: 24,
                        y: 12
                    },

                    align: 'center',
                    lineSpacing: 4,

                    wordWrap: {
                        width: objectiveWidth - 32,
                        useAdvancedWrap: true
                    }
                }
            )
            .setOrigin(0.5)
            .setDepth(15);

        this.statusText =
            this.add.text(
                bottomCenterX,
                this.worldBottom + 24,
                '',
                {
                    fontFamily: this.bodyFont,
                    fontSize: '22px',
                    color: '#66ddff',
                    backgroundColor: '#111318',

                    padding: {
                        x: 22,
                        y: 8
                    },

                    align: 'center',
                    wordWrap: {
                        width: bottomTextWidth,
                        useAdvancedWrap: true
                    }
                }
            )
            .setOrigin(0.5)
            .setDepth(12);

        this.objectiveMarker =
            this.add.text(
                0,
                0,
                '!',
                {
                    fontFamily: this.headingFont,
                    fontSize: '26px',
                    color: '#fff27a',
                    backgroundColor: '#173044',
                    padding: {
                        x: 8,
                        y: 4
                    }
                }
            )
            .setOrigin(0.5)
            .setDepth(8)
            .setVisible(false);

        this.tweens.add({
            targets: this.objectiveMarker,
            y: '-=8',
            duration: 500,
            yoyo: true,
            repeat: -1
        });

        const codexButton =
            this.add.rectangle(
                hudLeft + hudWidth / 2,
                718,
                hudWidth - 40,
                62,
                0x203c50,
                1
            )
            .setStrokeStyle(3, this.uiColors.accent)
            .setDepth(11)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.showCodexPanel());

        this.hudCodexText =
            this.add.text(
                codexButton.x,
                codexButton.y,
                '',
                {
                    fontFamily: this.headingFont,
                    fontSize: '20px',
                    color: '#ffffff',
                    align: 'center',
                    lineSpacing: 3
                }
            )
            .setOrigin(0.5)
            .setDepth(12);

        this.updateHUD();
    }

    // =====================================================
    // TUTORIAL
    // =====================================================

    private startTutorial()
    {
        this.tutorialComplete = false;
        this.tutorialStep = 1;

        this.showStatus(
            `Welcome, Junior Commander! Your ${this.selectedPlanet} crew is counting on you.`
        );

        this.updateTutorialObjective();
    }

    private updateTutorialObjective()
    {
        const target =
            this.tutorialStep <= 2
                ? this.habitat
                : this.tutorialStep === 3
                    ? this.solarArray
                    : this.tutorialStep === 4
                        ? this.greenhouse
                        : this.tutorialStep === 5
                            ? this.commStation
                            : this.shelter;

        this.objectiveMarker
            .setPosition(
                target.x,
                target.y - 76
            )
            .setVisible(true);

        if (this.tutorialStep === 1)
        {
            this.tutorialText.setText([
                'STEP 1 • FIND THE HABITAT',
                'Walk close and press E or USE.',
                'Astronauts live, rest, and stay safe inside.'
            ]);
        }

        else if (this.tutorialStep === 2)
        {
            this.tutorialText.setText([
                'STEP 2 • START LIFE SUPPORT',
                'Stay near the Habitat and press R or ECLSS.',
                'Watch how ECLSS uses Battery power.'
            ]);
        }

        else if (this.tutorialStep === 3)
        {
            this.tutorialText.setText([
                'STEP 3 • RECHARGE THE BATTERY',
                'Find the Solar Array and press E or USE.',
                'Solar panels turn sunlight into electricity.'
            ]);
        }

        else if (this.tutorialStep === 4)
        {
            this.tutorialText.setText([
                'STEP 4 • GROW SPACE FOOD',
                'Find the Greenhouse and press E or USE.',
                'Plants need Water and electricity to grow.'
            ]);
        }

        else if (this.tutorialStep === 5)
        {
            if (this.selectedPlanet === 'Moon')
            {
                this.tutorialText.setText([
                    'STEP 5 • CONTACT EARTH',
                    'Find the Comm Station and press E or USE.',
                    'Moon messages reach Earth fairly quickly.'
                ]);
            }
            else
            {
                this.tutorialText.setText([
                    'STEP 5 • CONTACT EARTH',
                    'Find the Comm Station and press E or USE.',
                    'Mars messages can take many minutes.'
                ]);
            }
        }

        else if (this.tutorialStep === 6)
        {
            this.tutorialText.setText([
                'STEP 6 • FIND THE SAFETY SHELTER',
                'Crews sometimes act before Earth can reply.',
                'Find the Radiation Shelter and press E or USE.'
            ]);
        }
    }

    private completeTutorial()
    {
        this.tutorialComplete = true;
        this.tutorialStep = 4;
        this.objectiveMarker.setVisible(false);

        this.tutorialText.setText([
            'TRAINING COMPLETE!',
            'You know the basic safety systems.',
            'Your real mission can now begin.'
        ]);

        this.showStatus(
            'Junior Commander training complete!'
        );

        this.time.delayedCall(
            4500,
            () =>
            {
                this.tutorialText.setText('');
                this.startPowerSystem();
                this.startLifeSupportSystem();
                this.startFoodSystem();

                this.startMissionLoop();

                this.scheduleRadiationScenario();
            }
        );
    }

    // =====================================================
    // BASE POWER SYSTEM
    // =====================================================

    private startPowerSystem()
    {
        if (this.powerSystemStarted)
        {
            return;
        }

        this.powerSystemStarted = true;

        this.showStatus(
            'Base systems online. The outpost now uses Battery power continuously.'
        );

        this.time.addEvent({
            delay: 6000,
            callback: () =>
            {
                if (
                    this.missionEnded ||
                    this.upgradeMenuOpen
                )
                {
                    return;
                }

                // Normal base electricity consumption
                if (this.power > 0)
                {
                    this.power =
                        Phaser.Math.Clamp(
                            this.power - 2,
                            0,
                            100
                        );
                }

                // If battery becomes empty,
                // the air supply begins failing.
                // (Life Support is calculated from oxygen,
                // water and CO2, so the penalty is applied
                // to oxygen instead of the final score.)

                if (this.power <= 0)
                {
                    this.oxygen =
                        Phaser.Math.Clamp(
                            this.oxygen - 4,
                            0,
                            100
                        );

                    this.updateLifeSupportScore();

                    this.showStatus(
                        'Battery empty! Life Support is losing stability.'
                    );
                }

                // One warning instead of spamming
                // the player every few seconds.

                if (
                    this.power <= 20 &&
                    !this.lowPowerWarningShown
                )
                {
                    this.lowPowerWarningShown = true;

                    this.showStatus(
                        'LOW BATTERY — Recharge at the Solar Array.'
                    );
                }

                if (this.power > 25)
                {
                    this.lowPowerWarningShown = false;
                }

                this.updateHUD();
            },

            loop: true
        });
    }

    // =====================================================
    // LIFE SUPPORT CYCLE
    // =====================================================

    private startLifeSupportSystem()
    {
        if (this.lifeSupportTimer)
        {
            return;
        }

        this.lifeSupportTimer =
            this.time.addEvent({

                delay: 6000,

                callback: () =>
                {
                    if (
                        this.missionEnded ||
                        this.upgradeMenuOpen
                    )
                    {
                        return;
                    }

                    // -----------------------------------------
                    // CREW USE
                    // -----------------------------------------

                    // Astronauts breathe oxygen.
                    this.oxygen =
                        Phaser.Math.Clamp(
                            this.oxygen - 2,
                            0,
                            100
                        );

                    // Crew needs water.
                    this.water =
                        Phaser.Math.Clamp(
                            this.water - 1,
                            0,
                            100
                        );

                    // Breathing produces CO2.
                    this.co2 =
                        Phaser.Math.Clamp(
                            this.co2 + 2,
                            0,
                            100
                        );

                    // -----------------------------------------
                    // ECLSS
                    // -----------------------------------------

                    if (this.eclssActive)
                    {
                        const eclssPowerCost =
                            this.getECLSSPowerCost();

                        if (this.power >= eclssPowerCost)
                        {
                            // ECLSS needs electricity.
                            this.power =
                                Phaser.Math.Clamp(
                                    this.power - eclssPowerCost,
                                    0,
                                    100
                                );

                            // Simplified educational model:
                            // maintain breathable air
                            this.oxygen =
                                Phaser.Math.Clamp(
                                    this.oxygen + 2,
                                    0,
                                    100
                                );

                            // remove CO2
                            this.co2 =
                                Phaser.Math.Clamp(
                                    this.co2 - 3,
                                    0,
                                    100
                                );

                            // recover some water
                            this.water =
                                Phaser.Math.Clamp(
                                    this.water + 1,
                                    0,
                                    100
                                );
                        }
                        else
                        {
                            this.eclssActive = false;

                            this.showStatus(
                                'ECLSS shut down — the Battery is too low!'
                            );
                        }
                    }

                    this.updateLifeSupportScore();

                    this.checkLifeSupportWarnings();

                    this.updateHUD();
                },

                loop: true
            });
    }

    private getECLSSPowerCost()
    {
        if (this.eclssLevel === 1)
        {
            return 3;
        }

        if (this.eclssLevel === 2)
        {
            return 2;
        }

        return 1;
    }

    private checkLifeSupportWarnings()
    {
        let warning = '';

        if (this.oxygen <= 30)
        {
            warning =
                'LOW OXYGEN — Turn on ECLSS and check your Battery.';
        }

        else if (this.co2 >= 60)
        {
            warning =
                'HIGH CO2 — Air quality is becoming unsafe.';
        }

        else if (this.water <= 25)
        {
            warning =
                'LOW WATER — The crew needs a reliable water supply.';
        }

        else if (this.lifeSupport <= 25)
        {
            warning =
                'LIFE SUPPORT CRITICAL — Crew safety is at risk.';
        }

        if (
            warning !== '' &&
            warning !== this.lastLifeSupportWarning
        )
        {
            this.lastLifeSupportWarning =
                warning;

            this.showStatus(warning);
        }

        if (
            this.oxygen > 35 &&
            this.co2 < 55 &&
            this.water > 30
        )
        {
            this.lastLifeSupportWarning = '';
        }
    }

    // =====================================================
    // NASA LIVE DATA
    // =====================================================

    private async loadNASAData()
    {
        try
        {
            const events =
                await fetchRecentSEPEvents();

            console.log(
                'NASA DONKI SEP EVENTS:',
                events
            );

            if (events.length > 0)
            {
                this.spaceWeatherText.setText(
                    `NASA Space Weather: SEP ALERT (${events.length})`
                );

                this.spaceWeatherText.setColor(
                    '#ff6b6b'
                );
            }
            else
            {
                this.spaceWeatherText.setText(
                    'NASA Space Weather: Quiet — no recent SEP events'
                );

                this.spaceWeatherText.setColor(
                    '#8cff98'
                );
            }
        }
        catch (error)
        {
            console.error(
                'NASA data error:',
                error
            );

            this.spaceWeatherText.setText(
                'NASA Space Weather: Data unavailable'
            );

            this.spaceWeatherText.setColor(
                '#aaaaaa'
            );
        }
    }

    // =====================================================
    // HISTORICAL NASA TRAINING EVENT
    // =====================================================

    private async loadTrainingScenario()
    {
        try
        {
            const events =
                await fetchTrainingSEPEvent();

            console.log(
                'NASA TRAINING SEP EVENT:',
                events
            );

            if (events.length > 0)
            {
                this.trainingEvent =
                    events[0];

                console.log(
                    'Training Event ID:',
                    this.trainingEvent.sepID
                );

                if (this.trainingEvent._unknownYSource === 'cached-nasa-historical')
                {
                    console.warn(
                        'Using cached NASA DONKI historical SEP event for training.'
                    );
                }

                this.scheduleRadiationScenario();
            }
        }
        catch (error)
        {
            console.error(
                'NASA training scenario error:',
                error
            );
        }
    }

    private scheduleRadiationScenario()
    {
        // NASA data might load before the tutorial finishes.
        // Do nothing until both conditions are ready.

        if (!this.trainingEvent)
        {
            return;
        }

        if (!this.tutorialComplete)
        {
            return;
        }

        if (this.radiationScenarioScheduled)
        {
            return;
        }

        this.radiationScenarioScheduled = true;

        this.showStatus(
            'Mission systems active. Stay alert for changing space conditions.'
        );

        this.time.delayedCall(
            6000,
            () =>
            {
                this.startRadiationEmergency();
            }
        );
    }

    // =====================================================
    // RADIATION EMERGENCY
    // =====================================================

    private startRadiationEmergency()
    {
        if (!this.trainingEvent)
        {
            return;
        }

        this.radiationEmergencyActive = true;

        this.unlockKnowledge('sep', 'donki');

        const nasaTrainingLabel =
            this.trainingEvent._unknownYSource === 'cached-nasa-historical'
                ? 'NASA HISTORICAL SEP • TRAINING'
                : 'NASA SEP EVENT • TRAINING';

        this.emergencyText
            .setColor('#ffb0aa')
            .setBackgroundColor('#4a1115')
            .setVisible(true)
            .setText([
                `RADIATION ALERT • ${nasaTrainingLabel}`,
                'Reach the Radiation Shelter now!'
            ]);

        this.cameras.main.flash(
            500,
            255,
            60,
            60
        );

        this.radiationTimer =
            this.time.addEvent({

                delay: 2500,

                callback: () =>
                {
                    if (
                        !this.radiationEmergencyActive ||
                        this.missionEnded
                    )
                    {
                        return;
                    }

                    this.radiation =
                        Phaser.Math.Clamp(
                            this.radiation + 3,
                            0,
                            100
                        );

                    this.updateHUD();

                    this.showStatus(
                        'Radiation exposure is rising. Reach shelter!'
                    );

                    if (
                        this.radiation >= 80
                    )
                    {
                        this.showCriticalRadiationWarning();
                    }

                    this.checkMissionFailure();
                },

                loop: true
            });
    }

    private enterRadiationShelter()
    {
        if (
            !this.radiationEmergencyActive
        )
        {
            return;
        }

        this.radiationEmergencyActive = false;

        this.successfulShelters += 1;

        this.updateMissionObjective();

        if (this.radiationTimer)
        {
            this.radiationTimer.destroy();
        }

        this.power =
            Phaser.Math.Clamp(
                this.power - 5,
                0,
                100
            );

        this.updateHUD();

        this.emergencyText.setText('').setVisible(false);

        this.showStatus(
            'Crew safe. Radiation exposure has stabilized.'
        );
    }

    private showCriticalRadiationWarning()
    {
        this.emergencyText
            .setColor('#ffb0aa')
            .setBackgroundColor('#4a1115')
            .setVisible(true)
            .setText([
                'CRITICAL RADIATION',
                'Reach shelter immediately!'
            ]);

        this.showStatus(
            'CRITICAL RADIATION - Reach shelter immediately!'
        );
    }

    // =====================================================
    // SOLAR POWER
    // =====================================================

    private useSolarArray()
    {
        if (
            this.selectedPlanet === 'Moon' &&
            this.moonShadowActive
        )
        {
            this.showStatus(
                'No solar energy available — the Solar Array is currently in shadow.'
            );

            return;
        }

        if (!this.solarReady)
        {
            this.showStatus(
                'Solar panels are charging. Try again soon!'
            );

            return;
        }

        if (this.power >= 100)
        {
            this.showStatus(
                'Battery full! Your stored power is ready.'
            );

            return;
        }

        const baseSolarGain =
            this.selectedPlanet === 'Moon'
                ? 25
                : 15;

        const solarBonus =
            (this.solarLevel - 1) * 5;

        let solarGain =
            baseSolarGain + solarBonus;

        // Mars dust reduces incoming solar energy.
        if (
            this.selectedPlanet === 'Mars' &&
            this.marsDustActive
        )
        {
            solarGain =
                Math.ceil(
                    solarGain * 0.5
                );
        }

        const previousPower =
            this.power;

        this.power =
            Phaser.Math.Clamp(
                this.power + solarGain,
                0,
                100
            );

        const actualGain =
            this.power - previousPower;

        this.solarReady = false;

        this.updateHUD();

        this.showStatus(
            `Solar energy stored in Battery. +${actualGain} energy`
        );

        // Tutorial progress

        if (
            !this.tutorialComplete &&
            this.tutorialStep === 3
        )
        {
            this.tutorialStep = 4;

            this.time.delayedCall(
                1000,
                () =>
                {
                    this.updateTutorialObjective();
                }
            );
        }

        // Solar Array needs time before
        // another game energy cycle is ready.

        this.time.delayedCall(
            10000,
            () =>
            {
                this.solarReady = true;

                if (this.gameStarted)
                {
                    this.showStatus(
                        'Solar energy is available again.'
                    );
                }
            }
        );
    }

    // =====================================================
    // GREENHOUSE / FOOD PRODUCTION
    // =====================================================

    private useGreenhouse()
    {
        if (this.greenhouseGrowing)
        {
            this.showStatus(
                `Crop is still growing. Progress: ${this.greenhouseProgress} / 3`
            );

            return;
        }

        if (this.food >= 100)
        {
            this.showStatus(
                'Food storage is full. Great growing!'
            );

            return;
        }

        if (this.power < 6)
        {
            this.showStatus(
                'The Greenhouse needs more Battery power.'
            );

            return;
        }

        if (this.water < 5)
        {
            this.showStatus(
                'The Greenhouse needs more Water for a new crop.'
            );

            return;
        }

        // Starting a crop uses resources.

        this.power =
            Phaser.Math.Clamp(
                this.power - 3,
                0,
                100
            );

        this.water =
            Phaser.Math.Clamp(
                this.water - 5,
                0,
                100
            );

        this.greenhouseGrowing = true;
        this.greenhouseProgress = 0;

        this.updateLifeSupportScore();
        this.updateHUD();

        this.showStatus(
            'Crop planted! The Greenhouse used Water and Battery power.'
        );

        // Tutorial progression

        if (
            !this.tutorialComplete &&
            this.tutorialStep === 4
        )
        {
            this.tutorialStep = 5;

            this.time.delayedCall(
                1000,
                () =>
                {
                    this.updateTutorialObjective();
                }
            );
        }

        this.processGreenhouseGrowth();
    }

    private processGreenhouseGrowth()
    {
        if (!this.greenhouseGrowing)
        {
            return;
        }

        this.time.delayedCall(
            5000,
            () =>
            {
                if (!this.greenhouseGrowing)
                {
                    return;
                }

                // Greenhouse equipment needs electricity:
                // lights, pumps, fans and controls.

                if (this.power < 2)
                {
                    this.showStatus(
                        'Greenhouse growth paused — Battery power is too low.'
                    );

                    // Try again later.
                    this.processGreenhouseGrowth();

                    return;
                }

                this.power =
                    Phaser.Math.Clamp(
                        this.power - 2,
                        0,
                        100
                    );

                this.greenhouseProgress += 1;

                this.updateHUD();

                if (this.greenhouseProgress >= 3)
                {
                    this.harvestGreenhouse();

                    return;
                }

                this.showStatus(
                    `Greenhouse crop growing: ${this.greenhouseProgress} / 3`
                );

                this.processGreenhouseGrowth();
            }
        );
    }

    private harvestGreenhouse()
    {
        this.greenhouseGrowing = false;
        this.greenhouseProgress = 0;

        this.totalHarvests += 1;

        const previousFood =
            this.food;

        const greenhouseYield =
            25 +
            (
                (this.greenhouseLevel - 1)
                * 5
            );

        this.food =
            Phaser.Math.Clamp(
                this.food + greenhouseYield,
                0,
                100
            );

        const foodProduced =
            this.food - previousFood;

        this.science =
            Phaser.Math.Clamp(
                this.science + 3,
                0,
                999
            );

        this.updateHUD();
        this.updateMissionObjective();

        this.showStatus(
            `Crop ready! Food +${foodProduced} | Science +3`
        );
    }

    // =====================================================
    // CREW FOOD SYSTEM
    // =====================================================

    private startFoodSystem()
    {
        if (this.foodSystemStarted)
        {
            return;
        }

        this.foodSystemStarted = true;

        this.time.addEvent({

            delay: 8000,

            callback: () =>
            {
                if (
                    this.missionEnded ||
                    this.upgradeMenuOpen
                )
                {
                    return;
                }

                // Crew eats food during the mission.

                if (this.food > 0)
                {
                    this.food =
                        Phaser.Math.Clamp(
                            this.food - 2,
                            0,
                            100
                        );
                }

                // No food affects crew health.
                if (this.food <= 0)
                {
                    this.crewHealth =
                        Phaser.Math.Clamp(
                            this.crewHealth - 5,
                            0,
                            100
                        );
                }

                if (
                    this.food <= 20 &&
                    !this.foodWarningShown
                )
                {
                    this.foodWarningShown = true;

                    this.showStatus(
                        'LOW FOOD — Start a Greenhouse crop soon.'
                    );
                }

                if (this.food > 25)
                {
                    this.foodWarningShown = false;
                }

                if (this.crewHealth <= 30)
                {
                    this.showStatus(
                        'CREW HEALTH CRITICAL — Food supply has been empty too long.'
                    );
                }

                this.updateHUD();
            },

            loop: true
        });
    }

    // =====================================================
    // MISSION LOOP
    // =====================================================

    private startMissionLoop()
    {
        if (this.missionLoopStarted)
        {
            return;
        }

        this.missionLoopStarted = true;
        this.missionEnded = false;

        this.missionCycle = 1;
        this.missionTimeRemaining =
            this.missionCycleDuration;

        this.updateMissionObjective();

        this.showStatus(
            'MISSION START — Keep your crew safe for 3 training cycles.'
        );

        this.missionTimer =
            this.time.addEvent({

                delay: 1000,

                callback: () =>
                {
                    if (
                        this.missionEnded ||
                        this.upgradeMenuOpen
                    )
                    {
                        return;
                    }

                    this.missionTimeRemaining -= 1;

                    this.checkMissionFailure();

                    if (this.missionEnded)
                    {
                        return;
                    }

                    if (
                        this.missionTimeRemaining <= 0
                    )
                    {
                        this.nextMissionCycle();
                    }

                    this.updateHUD();
                },

                loop: true
            });
    }

    private nextMissionCycle()
    {
        if (
            this.missionCycle >=
            this.maxMissionCycles
        )
        {
            this.completeMission();

            return;
        }

        // Reward for surviving the cycle

        this.science =
            Phaser.Math.Clamp(
                this.science + 5,
                0,
                999
            );

        this.pendingNextCycle =
            this.missionCycle + 1;

        this.openResearchBreak();
    }

    // =====================================================
    // RESEARCH / UPGRADES
    // =====================================================

    private openResearchBreak()
    {
        this.resetTouchInput();
        this.upgradeMenuOpen = true;

        this.updateHUD();

        const modalWidth =
            Math.min(
                1120,
                this.scale.width - 50
            );

        console.log(
            'RESEARCH BREAK OPEN',
            {
                cycle: this.missionCycle,
                science: this.science,
                solar: this.solarLevel,
                eclss: this.eclssLevel,
                greenhouse: this.greenhouseLevel
            }
        );

        const inputBlocker =
            this.add.rectangle(
                this.scale.width / 2,
                this.scale.height / 2,
                this.scale.width,
                this.scale.height,
                0x000000,
                0.7
            )
            .setDepth(199)
            .setInteractive();

        this.upgradeTemporaryObjects.push(
            inputBlocker
        );

        this.upgradePanel =
            this.add.rectangle(
                this.scale.width / 2,
                this.scale.height / 2,
                modalWidth,
                640,
                this.uiColors.panelDark,
                1
            )
            .setStrokeStyle(
                4,
                0x8fdcff
            )
            .setDepth(200);

        this.upgradeText =
            this.add.text(
                this.scale.width / 2,
                this.scale.height / 2 - 265,
                '',
                {
                    fontFamily: this.headingFont,
                    fontSize: '32px',
                    color: '#ffffff',
                    align: 'center',
                    lineSpacing: 6
                }
            )
            .setOrigin(0.5)
            .setDepth(201);

        this.refreshUpgradeMenu();

        this.createResearchButton(
            this.scale.width / 2 - 360,
            this.scale.height / 2 + 5,
            320,
            'SOLAR EFFICIENCY',
            `Lv.${this.solarLevel} → Lv.${Math.min(this.solarLevel + 1, 3)}\n\nMore energy from sunlight\n\nCOST: 5 SCIENCE`,
            () => this.purchaseUpgrade('solar'),
            0xffd166
        );

        this.createResearchButton(
            this.scale.width / 2,
            this.scale.height / 2 + 5,
            320,
            'ECLSS EFFICIENCY',
            `Lv.${this.eclssLevel} → Lv.${Math.min(this.eclssLevel + 1, 3)}\n\nUses less Battery\n\nCOST: 5 SCIENCE`,
            () => this.purchaseUpgrade('eclss'),
            0x63c7e8
        );

        this.createResearchButton(
            this.scale.width / 2 + 360,
            this.scale.height / 2 + 5,
            320,
            'GREENHOUSE RESEARCH',
            `Lv.${this.greenhouseLevel} → Lv.${Math.min(this.greenhouseLevel + 1, 3)}\n\nGrow more Food\n\nCOST: 5 SCIENCE`,
            () => this.purchaseUpgrade('greenhouse'),
            0x69d58c
        );

        this.createResearchButton(
            this.scale.width / 2,
            this.scale.height / 2 + 245,
            480,
            '[C] Save Science and continue',
            '',
            () => this.finishResearchBreak(),
            0x9e9cff
        );

        this.upgradeFeedbackText =
            this.add.text(
                this.scale.width / 2,
                this.scale.height / 2 + 295,
                '',
                {
                    fontFamily: this.bodyFont,
                    fontSize: '22px',
                    color: '#ffdd88',
                    align: 'center'
                }
            )
            .setOrigin(0.5)
            .setDepth(204);

        this.upgradeTemporaryObjects.push(
            this.upgradeFeedbackText
        );
    }

    private createResearchButton(
        x: number,
        y: number,
        width: number,
        title: string,
        details: string,
        action: () => void,
        accentColor: number
    )
    {
        const cardHeight =
            details
                ? 285
                : 54;

        const button =
            this.add.rectangle(
                x,
                y,
                width,
                cardHeight,
                this.uiColors.panel,
                1
            )
            .setStrokeStyle(3, accentColor)
            .setDepth(202)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', action);

        button.on('pointerover', () =>
        {
            button.setFillStyle(accentColor, 0.22);
        });

        button.on('pointerout', () =>
        {
            button.setFillStyle(this.uiColors.panel, 1);
        });

        const label =
            this.add.text(
                x,
                y,
                details
                    ? `${title}\n${details}`
                    : title,
                {
                    fontFamily: this.bodyFont,
                    fontSize: details ? '24px' : '28px',
                    color: '#ffffff',
                    align: 'center',
                    lineSpacing: 6,
                    wordWrap: {
                        width: width - 40,
                        useAdvancedWrap: true
                    }
                }
            )
            .setOrigin(0.5)
            .setDepth(203);

        this.upgradeTemporaryObjects.push(
            button,
            label
        );
    }

    private refreshUpgradeMenu()
    {
        if (!this.upgradeText)
        {
            return;
        }

        this.upgradeText.setText([
            'RESEARCH BREAK',
            '',
            'Use Science to improve your outpost!',
            `SCIENCE AVAILABLE: ${this.science}`,
            'Keys: [1] Solar  [2] ECLSS  [3] Greenhouse  [C] Continue'
        ]);
    }

    private handleUpgradeInput()
    {
        if (
            Phaser.Input.Keyboard.JustDown(
                this.upgradeOneKey
            )
        )
        {
            this.purchaseUpgrade('solar');
        }

        else if (
            Phaser.Input.Keyboard.JustDown(
                this.upgradeTwoKey
            )
        )
        {
            this.purchaseUpgrade('eclss');
        }

        else if (
            Phaser.Input.Keyboard.JustDown(
                this.upgradeThreeKey
            )
        )
        {
            this.purchaseUpgrade('greenhouse');
        }

        else if (
            Phaser.Input.Keyboard.JustDown(
                this.skipUpgradeKey
            )
        )
        {
            this.finishResearchBreak();
        }
    }

    private purchaseUpgrade(
        type: 'solar' | 'eclss' | 'greenhouse'
    )
    {
        if (!this.upgradeMenuOpen)
        {
            return;
        }

        const cost = 5;

        const currentLevel =
            type === 'solar'
                ? this.solarLevel
                : type === 'eclss'
                    ? this.eclssLevel
                    : this.greenhouseLevel;

        if (currentLevel >= 3)
        {
            this.upgradeFeedbackText?.setText(
                'This research is already at maximum level.'
            );

            this.showStatus(
                'This research is already at maximum level.'
            );

            return;
        }

        if (this.science < cost)
        {
            this.upgradeFeedbackText?.setText(
                'Not enough Science for this research.'
            );

            this.showStatus(
                'Not enough Science for this research.'
            );

            return;
        }

        // -----------------------------------------
        // SOLAR
        // -----------------------------------------

        if (type === 'solar')
        {
            this.solarLevel += 1;
        }

        // -----------------------------------------
        // ECLSS
        // -----------------------------------------

        else if (type === 'eclss')
        {
            this.eclssLevel += 1;
        }

        // -----------------------------------------
        // GREENHOUSE
        // -----------------------------------------

        else
        {
            this.greenhouseLevel += 1;
        }

        this.science -= cost;

        this.savePlanetProgress();

        this.updateHUD();

        const upgradeName =
            type === 'solar'
                ? 'Solar Efficiency'
                : type === 'eclss'
                    ? 'ECLSS Efficiency'
                    : 'Greenhouse Research';

        const upgradedLevel =
            type === 'solar'
                ? this.solarLevel
                : type === 'eclss'
                    ? this.eclssLevel
                    : this.greenhouseLevel;

        const confirmationMessage =
            `${upgradeName} upgraded to Level ${upgradedLevel}!`;

        this.showStatus(confirmationMessage);

        console.log(
            'RESEARCH UPGRADE PURCHASED',
            {
                type,
                scienceRemaining: this.science,
                solar: this.solarLevel,
                eclss: this.eclssLevel,
                greenhouse: this.greenhouseLevel
            }
        );

        // Only one upgrade per research break.
        this.finishResearchBreak(confirmationMessage);
    }

    private finishResearchBreak(
        confirmationMessage?: string
    )
    {
        if (!this.upgradeMenuOpen)
        {
            return;
        }

        if (this.upgradePanel)
        {
            this.upgradePanel.destroy();
            this.upgradePanel = undefined;
        }

        if (this.upgradeText)
        {
            this.upgradeText.destroy();
            this.upgradeText = undefined;
        }

        for (const gameObject of this.upgradeTemporaryObjects)
        {
            gameObject.destroy();
        }

        this.upgradeTemporaryObjects = [];
        this.upgradeFeedbackText = undefined;

        this.upgradeMenuOpen = false;

        this.missionCycle =
            this.pendingNextCycle;

        this.missionTimeRemaining =
            this.missionCycleDuration;

        this.updateMissionObjective();
        this.updateHUD();

        this.showStatus(
            confirmationMessage ??
            `Mission Cycle ${this.missionCycle} started.`
        );

        this.schedulePlanetEnvironmentEvent();
    }

    // =====================================================
    // PLANET ENVIRONMENT EVENTS
    // =====================================================

    private schedulePlanetEnvironmentEvent()
    {
        if (this.environmentEventTriggered)
        {
            return;
        }

        if (this.missionCycle !== 2)
        {
            return;
        }

        this.environmentEventTriggered = true;

        this.time.delayedCall(
            8000,
            () =>
            {
                if (this.missionEnded)
                {
                    return;
                }

                if (this.selectedPlanet === 'Moon')
                {
                    this.startMoonShadowEvent();
                }
                else
                {
                    this.startMarsDustEvent();
                }
            }
        );
    }

    private startMoonShadowEvent()
    {
        this.moonShadowActive = true;

        this.unlockKnowledge('moon-shadow');

        this.emergencyText
            .setColor('#dce9f4')
            .setBackgroundColor('#1b3048')
            .setVisible(true)
            .setText([
                'MOON SHADOW • SOLAR POWER BLOCKED',
                'Use stored Battery energy.'
            ]);

        this.showStatus(
            'Moon challenge: Solar generation is unavailable in local shadow.'
        );

        this.updateHUD();

        this.time.delayedCall(
            12000,
            () =>
            {
                if (this.missionEnded)
                {
                    return;
                }

                this.moonShadowActive = false;

                if (!this.radiationEmergencyActive)
                {
                    this.emergencyText.setText('').setVisible(false);
                }

                this.showStatus(
                    'Sunlight has returned to the Solar Array.'
                );

                this.updateHUD();
            }
        );
    }

    private startMarsDustEvent()
    {
        this.marsDustActive = true;

        this.unlockKnowledge('mars-dust');

        this.emergencyText
            .setColor('#ffe0ba')
            .setBackgroundColor('#54291b')
            .setVisible(true)
            .setText([
                'MARS DUST • SOLAR POWER REDUCED',
                'Watch your Battery level.'
            ]);

        this.showStatus(
            'Mars challenge: Dust is reducing solar power.'
        );

        this.updateHUD();

        this.time.delayedCall(
            15000,
            () =>
            {
                if (this.missionEnded)
                {
                    return;
                }

                this.marsDustActive = false;

                if (!this.radiationEmergencyActive)
                {
                    this.emergencyText.setText('').setVisible(false);
                }

                this.showStatus(
                    'Dust conditions improved. Solar efficiency returned to normal.'
                );

                this.updateHUD();
            }
        );
    }

    private updateMissionObjective()
    {
        if (this.missionEnded)
        {
            return;
        }

        this.objectiveMarker.setVisible(false);

        this.tutorialText.setText([
            `MISSION ${this.missionCycle}/${this.maxMissionCycles} • KEEP THE CREW SAFE`,
            `${this.totalHarvests > 0 ? '[DONE]' : '[ ]'} Food   ${this.totalEarthMessages > 0 ? '[DONE]' : '[ ]'} Earth Contact`,
            `${this.successfulShelters > 0 ? '[DONE]' : '[ ]'} Radiation Alert   •   Training Clock`
        ]);
    }

    private checkMissionFailure()
    {
        if (this.missionEnded)
        {
            return;
        }

        if (this.crewHealth <= 0)
        {
            this.failMission(
                'Crew Health reached zero.'
            );

            return;
        }

        if (this.lifeSupport <= 0)
        {
            this.failMission(
                'Life Support could no longer keep the crew safe.'
            );

            return;
        }

        if (this.radiation >= 100)
        {
            this.failMission(
                'Radiation Risk reached a critical level.'
            );

            return;
        }
    }

    private formatMissionEndPanel()
    {
        this.add.rectangle(
            this.scale.width / 2,
            this.scale.height / 2,
            this.scale.width,
            this.scale.height,
            0x03070c,
            0.78
        )
        .setDepth(140)
        .setInteractive();

        this.createPixelPanel(
            this.scale.width / 2,
            this.scale.height / 2,
            Math.min(820, this.scale.width - 100),
            600,
            this.uiColors.accent,
            145
        );

        this.tutorialText
            .setPosition(
                this.scale.width / 2,
                this.scale.height / 2
            )
            .setOrigin(0.5)
            .setDepth(150)
            .setStyle({
                fontFamily: this.bodyFont,
                fontSize: '27px',
                color: '#ffffff',
                align: 'center',
                lineSpacing: 5,
                padding: {
                    x: 28,
                    y: 22
                },
                wordWrap: {
                    width: Math.min(
                        720,
                        this.scale.width - 120
                    ),
                    useAdvancedWrap: true
                }
            });
    }

    private failMission(reason: string)
    {
        if (this.missionEnded)
        {
            return;
        }

        this.missionEnded = true;
        this.resetTouchInput();

        this.savePlanetProgress();

        if (this.missionTimer)
        {
            this.missionTimer.destroy();
        }

        this.formatMissionEndPanel();

        this.tutorialText.setText([
            'MISSION PAUSED',
            '',
            `REASON: ${reason}`,
            '',
            'Every space mission teaches us something.',
            'Check the systems and try a new plan.',
            '',
            'YOU CAN DO IT, COMMANDER!',
            '',
            '[ SPACE / TAP ]  TRY AGAIN'
        ]);

        this.emergencyText.setText('').setVisible(false);

        this.showStatus(
            'Training mission ended.'
        );

        const restartKey =
            this.input.keyboard!.addKey(
                Phaser.Input.Keyboard.KeyCodes.SPACE
            );

        restartKey.once(
            'down',
            () =>
            {
                this.scene.restart();
            }
        );

        this.tutorialText
            .setInteractive({ useHandCursor: true })
            .once('pointerdown', () => this.scene.restart());
    }

    private completeMission()
    {
        if (this.missionEnded)
        {
            return;
        }

        this.missionEnded = true;
        this.resetTouchInput();

        if (this.missionTimer)
        {
            this.missionTimer.destroy();
        }

        let completedBonusGoals = 0;

        if (this.totalHarvests > 0)
        {
            completedBonusGoals += 1;
        }

        if (this.totalEarthMessages > 0)
        {
            completedBonusGoals += 1;
        }

        if (this.successfulShelters > 0)
        {
            completedBonusGoals += 1;
        }

        // Surviving always earns at least one star.
        let stars = 1;

        if (completedBonusGoals >= 2)
        {
            stars = 2;
        }

        if (completedBonusGoals === 3)
        {
            stars = 3;
        }

        // End-of-mission science reward
        this.science += stars * 5;

        if (this.selectedPlanet)
        {
            const progress =
                this.saveData[
                    this.selectedPlanet
                ];

            progress.bestStars =
                Math.max(
                    progress.bestStars,
                    stars
                );

            progress.missionsCompleted += 1;
        }

        this.savePlanetProgress();
        this.unlockKnowledge('isru');

        const starDisplay =
            stars === 3
                ? '★ ★ ★'
                : stars === 2
                    ? '★ ★ ☆'
                    : '★ ☆ ☆';

        this.formatMissionEndPanel();

        this.tutorialText.setText([
            'MISSION COMPLETE!',
            '',
            starDisplay,
            '',
            `${this.selectedPlanet?.toUpperCase()} EXPLORER BADGE`,
            `Science reward: +${stars * 5}`,
            `Science Bank: ${this.science} pts`,
            '',
            `${this.totalHarvests > 0 ? '[DONE]' : '[ ]'} Grew food`,
            `${this.totalEarthMessages > 0 ? '[DONE]' : '[ ]'} Contacted Earth`,
            `${this.successfulShelters > 0 ? '[DONE]' : '[ ]'} Used radiation shelter`,
            '',
            'Great work, Commander!',
            '',
            '[ SPACE / TAP ]  PLAY AGAIN'
        ]);

        this.emergencyText.setText('').setVisible(false);

        const restartKey =
            this.input.keyboard!.addKey(
                Phaser.Input.Keyboard.KeyCodes.SPACE
            );

        restartKey.once(
            'down',
            () =>
            {
                this.scene.restart();
            }
        );

        this.tutorialText
            .setInteractive({ useHandCursor: true })
            .once('pointerdown', () => this.scene.restart());
    }

    // =====================================================
    // EARTH COMMUNICATION
    // =====================================================

    private requestEarthGuidance()
    {
        if (this.communicationPending)
        {
            this.showStatus(
                'Message already sent. Earth has not replied yet.'
            );

            return;
        }

        this.communicationPending = true;

        this.totalEarthMessages += 1;

        this.updateMissionObjective();

        const isMoon =
            this.selectedPlanet === 'Moon';

        // Real science:
        // Moon ≈ 1.28 sec one way.
        // Mars ≈ 4–24 min one way depending on distance.
        //
        // Mars time is compressed in this training game.

        const gameReplyDelay =
            isMoon
                ? 1300
                : 8000;

        if (isMoon)
        {
            this.showStatus(
                'Message sent to Earth — Moon signal delay is about 1.28 seconds one way.'
            );
        }
        else
        {
            this.showStatus(
                'Message sent. Real Mars delay can be 4–24 minutes one way. Training time is compressed.'
            );
        }

        this.updateHUD();

        // Tutorial progression

        if (
            !this.tutorialComplete &&
            this.tutorialStep === 5
        )
        {
            this.tutorialStep = 6;

            this.time.delayedCall(
                900,
                () =>
                {
                    this.updateTutorialObjective();
                }
            );
        }

        // Earth reply

        this.time.delayedCall(
            gameReplyDelay,
            () =>
            {
                this.communicationPending = false;

                this.updateHUD();

                if (this.radiationEmergencyActive)
                {
                    this.showStatus(
                        'MISSION CONTROL: Solar particle danger confirmed. Stop surface work and enter the Radiation Shelter!'
                    );
                }
                else
                {
                    this.showStatus(
                        'MISSION CONTROL: Outpost status received. Keep monitoring power, life support, food and crew safety.'
                    );
                }
            }
        );
    }

    // =====================================================
    // ECLSS CONTROL
    // =====================================================

    private toggleECLSS()
    {
        this.unlockKnowledge('water');

        // Turn OFF
        if (this.eclssActive)
        {
            this.eclssActive = false;

            this.showStatus(
                'ECLSS OFF — Battery use reduced, but air and water will slowly become less safe.'
            );

            this.updateHUD();

            return;
        }

        // Turn ON
        if (this.power < 3)
        {
            this.showStatus(
                'Not enough Battery power to start ECLSS.'
            );

            return;
        }

        this.eclssActive = true;

        // Startup energy
        this.power =
            Phaser.Math.Clamp(
                this.power - 3,
                0,
                100
            );

        // Immediate small stabilization
        this.oxygen =
            Phaser.Math.Clamp(
                this.oxygen + 2,
                0,
                100
            );

        this.co2 =
            Phaser.Math.Clamp(
                this.co2 - 3,
                0,
                100
            );

        this.water =
            Phaser.Math.Clamp(
                this.water + 1,
                0,
                100
            );

        this.updateLifeSupportScore();
        this.updateHUD();

        this.showStatus(
            'ECLSS ON — It uses Battery power to help keep air and water safe.'
        );

        // Tutorial progress
        if (
            !this.tutorialComplete &&
            this.tutorialStep === 2
        )
        {
            this.tutorialStep = 3;

            this.time.delayedCall(
                1000,
                () =>
                {
                    this.updateTutorialObjective();
                }
            );
        }
    }

    private updateLifeSupportScore()
    {
        const airQuality =
            100 - this.co2;

        this.lifeSupport =
            Math.round(
                (
                    this.oxygen +
                    this.water +
                    airQuality
                ) / 3
            );
    }

    // =====================================================
    // BUILDING INFO
    // =====================================================

    private showHabitatInfo()
    {
        this.showInfoPanel([
            'HABITAT',
            '',
            'This is your astronauts’ safe home.',
            'It provides space to live, work, and rest.',
            '',
            'ECLSS manages air and water for the crew.',
            'Press R or ECLSS nearby to turn it on or off.',
            'Remember: ECLSS needs electricity.'
        ]);

        if (
            !this.tutorialComplete &&
            this.tutorialStep === 1
        )
        {
            this.tutorialStep = 2;

            this.time.delayedCall(
                800,
                () =>
                {
                    this.updateTutorialObjective();
                }
            );
        }
    }

    private showShelterInfo()
    {
        this.showInfoPanel([
            'RADIATION SHELTER',
            '',
            'This bunker has extra-thick protective walls.',
            'Use it when a radiation warning appears.',
            '',
            'Solar events can send dangerous particles through space.',
            'During an alert, stop outdoor work and enter quickly.',
            'NASA space-weather data inspires these training alerts.'
        ]);

        if (
            !this.tutorialComplete &&
            this.tutorialStep === 6
        )
        {
            this.completeTutorial();
        }
    }

    // =====================================================
    // UI HELPERS
    // =====================================================

    private updateHUD()
    {
        let environmentStatus = 'NORMAL';

        if (this.moonShadowActive)
        {
            environmentStatus = 'LOCAL SHADOW';
        }

        if (this.marsDustActive)
        {
            environmentStatus = 'DUST';
        }

        const missionStatus =
            this.missionLoopStarted &&
            !this.missionEnded
                ? `Cycle ${this.missionCycle}/${this.maxMissionCycles} | ${this.missionTimeRemaining}s`
                : 'Training';

        const eclssStatus =
            this.eclssActive
                ? 'ON'
                : 'OFF';

        const communicationStatus =
            this.communicationPending
                ? 'WAITING FOR EARTH'
                : 'READY';

        this.hudText.setText([
            'OUTPOST STATUS',
            missionStatus
        ]);

        const bars = [
            {
                name: 'BATTERY',
                value: this.power,
                reversed: false
            },
            {
                name: 'CREW',
                value: this.crewHealth,
                reversed: false
            },
            {
                name: 'LIFE SUPPORT',
                value: this.lifeSupport,
                reversed: false
            },
            {
                name: 'FOOD',
                value: this.food,
                reversed: false
            },
            {
                name: 'RADIATION',
                value: this.radiation,
                reversed: true
            }
        ];

        const hudLeft =
            this.worldRight + this.uiGap;

        const hudRight =
            this.scale.width - 16;

        const barWidth =
            hudRight - hudLeft - 52;

        this.hudGraphics.clear();

        bars.forEach((bar, index) =>
        {
            const warning =
                bar.reversed
                    ? bar.value >= 50
                    : bar.value <= 40;

            const danger =
                bar.reversed
                    ? bar.value >= 75
                    : bar.value <= 20;

            const color =
                danger
                    ? this.uiColors.danger
                    : warning
                        ? this.uiColors.warning
                        : this.uiColors.success;

            const state =
                danger
                    ? 'DANGER'
                    : warning
                        ? 'WATCH'
                        : 'OK';

            const y = 112 + index * 58;

            this.hudBarLabels[index].setText(
                `${bar.name}  ${bar.value}%  ${state}`
            );

            this.hudGraphics.fillStyle(
                this.uiColors.panelDark,
                1
            );
            this.hudGraphics.fillRect(
                hudLeft + 22,
                y + 22,
                barWidth,
                15
            );

            this.hudGraphics.fillStyle(color, 1);
            this.hudGraphics.fillRect(
                hudLeft + 25,
                y + 25,
                Math.round(
                    (barWidth - 6) *
                    Phaser.Math.Clamp(bar.value, 0, 100) /
                    100
                ),
                9
            );
        });

        this.hudSecondaryText.setText([
            'BASE SYSTEMS',
            `O2        ${this.oxygen}`,
            `WATER     ${this.water}`,
            `CO2       ${this.co2}`,
            `ECLSS     ${eclssStatus}`,
            `EARTH     ${communicationStatus}`,
            `ENV       ${environmentStatus}`,
            `SCIENCE   ${this.science}`
        ]);

        this.hudResearchText.setText([
            'RESEARCH',
            `SOLAR       LV${this.solarLevel}`,
            `ECLSS       LV${this.eclssLevel}`,
            `GREENHOUSE  LV${this.greenhouseLevel}`
        ]);

        this.hudCodexText.setText([
            'SPACE NOTES  [K]',
            `${this.unlockedKnowledge.size} / 12 DISCOVERED`
        ]);
    }

    private showStatus(message: string)
    {
        const upperMessage =
            message.toUpperCase();

        const danger =
            upperMessage.includes('CRITICAL') ||
            upperMessage.includes('RADIATION') ||
            upperMessage.includes('FAILED') ||
            upperMessage.includes('EMPTY');

        const warning =
            upperMessage.includes('LOW') ||
            upperMessage.includes('DUST') ||
            upperMessage.includes('SHADOW') ||
            upperMessage.includes('NOT ENOUGH');

        const success =
            upperMessage.includes('SAFE') ||
            upperMessage.includes('COMPLETE') ||
            upperMessage.includes('UPGRADED');

        this.statusText
            .setColor(
                danger
                    ? '#ffaaa3'
                    : warning
                        ? '#ffe08a'
                        : success
                            ? '#9ff0b4'
                            : '#8fdcff'
            )
            .setBackgroundColor(
                danger
                    ? '#421419'
                    : warning
                        ? '#403416'
                        : success
                            ? '#143a27'
                            : '#111d29'
            )
            .setText(message);

        this.time.delayedCall(
            2500,
            () =>
            {
                this.statusText.setText('');
            }
        );
    }

    private showInfoPanel(lines: string[])
    {
        const title =
            lines[0] ?? 'OUTPOST GUIDE';

        const body =
            lines.slice(2);

        this.showReadingPanel(
            title,
            body,
            0x66ddff
        );
    }

    private showLearnPanel(
        topic:
            | 'habitat'
            | 'solar'
            | 'greenhouse'
            | 'communication'
            | 'shelter'
    )
    {
        if (topic === 'habitat')
        {
            this.unlockKnowledge('habitat', 'eclss');
            this.showKnowledgeCard('habitat');

            return;
        }

        if (topic === 'solar')
        {
            this.unlockKnowledge('solar');
            this.showKnowledgeCard('solar');

            return;
        }

        if (topic === 'greenhouse')
        {
            this.unlockKnowledge('greenhouse');
            this.showKnowledgeCard('greenhouse');

            return;
        }

        if (topic === 'communication')
        {
            this.unlockKnowledge('communication');
            this.showKnowledgeCard('communication');

            return;
        }

        this.unlockKnowledge('radiation');
        this.showKnowledgeCard('radiation');
    }

    private getKnowledgeCards(): KnowledgeCard[]
    {
        return [
            {
                id: 'habitat',
                title: 'SPACE HABITAT',
                lines: [
                    "A habitat is the astronauts' home in space.",
                    'It keeps the crew safe from the environment outside.',
                    'Inside, astronauts need breathable air, clean water',
                    'and a safe temperature.',
                    '',
                    'KEY IDEA: A space home creates conditions humans can survive in.'
                ]
            },
            {
                id: 'eclss',
                title: 'ECLSS — LIFE SUPPORT',
                lines: [
                    'ECLSS means Environmental Control and Life Support System.',
                    'It provides breathable air, removes carbon dioxide',
                    'and helps recycle water.',
                    'ECLSS needs electrical power to keep working.',
                    '',
                    'KEY IDEA: No power can become a life-support problem.'
                ]
            },
            {
                id: 'solar',
                title: 'SOLAR POWER',
                lines: [
                    'Solar panels turn sunlight into electricity.',
                    'The base stores some of this energy in batteries.',
                    'Moon shadows can stop charging.',
                    'Mars dust can reduce the sunlight reaching the panels.',
                    '',
                    'KEY IDEA: Save energy before conditions change.'
                ]
            },
            {
                id: 'greenhouse',
                title: 'GROWING FOOD IN SPACE',
                lines: [
                    'Long missions need a reliable food supply.',
                    'A greenhouse helps astronauts grow plants safely.',
                    'Plants still need water, energy and careful monitoring.',
                    '',
                    'KEY IDEA: Food production also uses limited resources.'
                ]
            },
            {
                id: 'communication',
                title: 'TALKING TO EARTH',
                lines: [
                    'Radio messages cannot travel instantly across space.',
                    'The Moon is close, so communication is fast.',
                    'Mars is much farther away. Messages take many minutes.',
                    '',
                    'KEY IDEA: Mars crews may act before Earth can reply.'
                ]
            },
            {
                id: 'radiation',
                title: 'SPACE RADIATION',
                lines: [
                    'High-energy particles can be dangerous to astronauts.',
                    "Earth's atmosphere and magnetic field help protect us.",
                    'The Moon has very little natural protection.',
                    'During danger, crews stop outside work and enter shelter.',
                    '',
                    'KEY IDEA: Radiation protection is part of mission planning.'
                ]
            },
            {
                id: 'sep',
                title: 'SOLAR ENERGETIC PARTICLES',
                lines: [
                    'SEP means Solar Energetic Particle event.',
                    'Some solar events send fast particles through space.',
                    'These particles can increase radiation risk.',
                    'NASA monitors space weather to help missions prepare.',
                    '',
                    'KEY IDEA: Space weather can affect astronaut safety.'
                ]
            },
            {
                id: 'donki',
                title: 'NASA DONKI',
                lines: [
                    'DONKI is a NASA space-weather information system.',
                    'It records solar flares, coronal mass ejections',
                    'and Solar Energetic Particle events.',
                    'This game uses DONKI data for its training scenario.',
                    '',
                    'KEY IDEA: Real data helps us understand mission risks.'
                ]
            },
            {
                id: 'moon-shadow',
                title: 'LIGHT AND SHADOW ON THE MOON',
                lines: [
                    'The Moon has no thick atmosphere to spread sunlight.',
                    'Crater walls can create long, very dark shadows.',
                    'A solar array in shadow cannot generate electricity.',
                    '',
                    'KEY IDEA: Battery storage matters when sunlight disappears.'
                ]
            },
            {
                id: 'mars-dust',
                title: 'DUST ON MARS',
                lines: [
                    'Mars has a thin atmosphere filled with fine dust.',
                    'Dust can reduce sunlight reaching solar panels.',
                    'The panels may then produce less electricity.',
                    '',
                    'KEY IDEA: Mars crews need backup power plans.'
                ]
            },
            {
                id: 'water',
                title: 'WATER IS PRECIOUS',
                lines: [
                    'Carrying lots of water from Earth is difficult.',
                    'Habitats recover and reuse water whenever possible.',
                    'Life-support systems help recycle water for the crew.',
                    '',
                    'KEY IDEA: Recycling reduces mission supplies.'
                ]
            },
            {
                id: 'isru',
                title: 'USING LOCAL RESOURCES',
                lines: [
                    'ISRU means In-Situ Resource Utilization.',
                    'It means using useful materials found at the destination.',
                    'Lunar water ice could someday support exploration.',
                    '',
                    'KEY IDEA: Local resources help crews become independent.'
                ]
            }
        ];
    }

    private unlockKnowledge(...ids: KnowledgeId[])
    {
        let changed = false;

        for (const id of ids)
        {
            if (!this.unlockedKnowledge.has(id))
            {
                this.unlockedKnowledge.add(id);
                changed = true;
            }
        }

        if (changed)
        {
            this.saveKnowledgeProgress();
            this.updateHUD();
            this.showStatus('New Space Note discovered!');
        }
    }

    private showKnowledgeCard(id: KnowledgeId)
    {
        const card =
            this.getKnowledgeCards()
                .find(item => item.id === id);

        if (!card)
        {
            return;
        }

        this.showReadingPanel(
            `SPACE NOTES • ${card.title}`,
            card.lines,
            this.uiColors.border
        );
    }

    private showCodexPanel()
    {
        this.resetTouchInput();
        this.closeReadingPanel();

        const overlay =
            this.add.rectangle(
                this.scale.width / 2,
                this.scale.height / 2,
                this.scale.width,
                this.scale.height,
                0x05080d,
                0.72
            )
            .setDepth(300)
            .setInteractive();

        const panel =
            this.add.rectangle(
                this.scale.width / 2,
                this.scale.height / 2,
                1120,
                670,
                this.uiColors.accent,
                1
            )
            .setFillStyle(this.uiColors.panel, 1)
            .setStrokeStyle(4, this.uiColors.accent)
            .setDepth(310);

        const title =
            this.add.text(
                this.scale.width / 2,
                76,
                `SPACE CODEX  •  ${this.unlockedKnowledge.size} / 12 DISCOVERED`,
                {
                    fontFamily: this.headingFont,
                    fontSize: '38px',
                    color: '#ffffff'
                }
            )
            .setOrigin(0.5)
            .setDepth(312);

        this.readingPanelObjects = [overlay, panel, title];

        const cards = this.getKnowledgeCards();

        cards.forEach((card, index) =>
        {
            const unlocked =
                this.unlockedKnowledge.has(card.id);

            const column = index < 6 ? 0 : 1;
            const row = index % 6;
            const x = this.scale.width / 2 + (column === 0 ? -275 : 275);
            const y = 150 + row * 78;

            const button =
                this.add.rectangle(
                    x,
                    y,
                    500,
                    58,
                    unlocked ? 0x203c50 : 0x20272e,
                    1
                )
                .setStrokeStyle(
                    2,
                    unlocked
                        ? this.uiColors.border
                        : this.uiColors.disabled
                )
                .setDepth(311);

            const label =
                this.add.text(
                    x - 225,
                    y,
                    unlocked
                        ? `[OPEN] ${card.title}`
                        : '[LOCKED] ???',
                    {
                        fontFamily: this.bodyFont,
                        fontSize: '24px',
                        color: unlocked ? '#ffffff' : '#85919b'
                    }
                )
                .setOrigin(0, 0.5)
                .setDepth(312);

            if (unlocked)
            {
                button
                    .setInteractive({ useHandCursor: true })
                    .on('pointerdown', () =>
                    {
                        this.showKnowledgeCard(card.id);
                    });
            }

            this.readingPanelObjects.push(button, label);
        });

        const closeButton =
            this.add.text(
                this.scale.width / 2,
                690,
                '[X] CLOSE  •  ESC',
                {
                    fontFamily: this.headingFont,
                    fontSize: '28px',
                    color: '#ffffff',
                    backgroundColor: '#7d3035',
                    padding: { x: 22, y: 10 }
                }
            )
            .setOrigin(0.5)
            .setDepth(312)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.closeReadingPanel());

        this.readingPanelObjects.push(closeButton);
        this.readingPanelOpen = true;
    }

    private getSpaceLibraryCategories(): LibraryCategory[]
    {
        return [
            {
                id: 'space-weather',
                title: 'SPACE WEATHER',
                articles: [
                    {
                        title: 'SOLAR FLARE',
                        lines: [
                            'A solar flare is a sudden burst of energy from the Sun.',
                            'It can release strong radiation into space.',
                            'Solar flares can also affect radio communication.',
                            '',
                            'KEY IDEA: The Sun can change space conditions very quickly.'
                        ]
                    },
                    {
                        title: 'CORONAL MASS EJECTION',
                        lines: [
                            'CME means Coronal Mass Ejection.',
                            'It is a huge cloud of plasma and magnetic field released by the Sun.',
                            'A CME can travel through space and disturb the space environment around planets.',
                            '',
                            'KEY IDEA: Solar storms can travel far beyond the Sun.'
                        ]
                    },
                    {
                        title: 'SOLAR ENERGETIC PARTICLES',
                        lines: [
                            'SEP means Solar Energetic Particle event.',
                            'Fast particles from the Sun can travel through space.',
                            'They can increase radiation risk for astronauts.',
                            '',
                            'KEY IDEA: Astronauts may need shelter during dangerous space weather.'
                        ]
                    },
                    {
                        title: 'NASA DONKI',
                        lines: [
                            'DONKI is a NASA space-weather information system.',
                            'It records solar flares, CMEs and SEP events.',
                            'This game uses NASA DONKI data in its radiation training scenario.',
                            '',
                            'KEY IDEA: Real NASA data helps missions understand space-weather risks.'
                        ]
                    }
                ]
            },
            {
                id: 'life-support',
                title: 'LIFE SUPPORT',
                articles: [
                    {
                        title: 'ECLSS',
                        lines: [
                            'ECLSS means Environmental Control and Life Support System.',
                            'It helps keep air breathable, remove carbon dioxide and recycle water.',
                            'The system needs electricity to operate.',
                            '',
                            'KEY IDEA: Life support and power depend on each other.'
                        ]
                    },
                    {
                        title: 'MAKING OXYGEN FROM WATER',
                        lines: [
                            'Electrolysis can split water into oxygen and hydrogen.',
                            'The oxygen can help support a crew.',
                            'The process needs electrical energy.',
                            '',
                            'KEY IDEA: Water can be an important life-support resource.'
                        ]
                    },
                    {
                        title: 'REMOVING CO2',
                        lines: [
                            'Astronauts breathe in oxygen and breathe out carbon dioxide.',
                            'Too much CO2 can make the air unsafe.',
                            'Life-support systems remove CO2 from the cabin.',
                            '',
                            'KEY IDEA: Safe air is not only about adding oxygen.'
                        ]
                    },
                    {
                        title: 'RECYCLING WATER',
                        lines: [
                            'Water is heavy and expensive to carry from Earth.',
                            'Space missions recover and reuse as much water as possible.',
                            'Recycling helps crews stay away from Earth for longer.',
                            '',
                            'KEY IDEA: In space, waste can become a useful resource.'
                        ]
                    }
                ]
            },
            {
                id: 'moon',
                title: 'THE MOON',
                articles: [
                    {
                        title: 'THE LUNAR SOUTH POLE',
                        lines: [
                            "The Moon's south polar region is important for future exploration.",
                            'Some areas receive useful sunlight while nearby craters can remain extremely dark.',
                            'Scientists have also found evidence of water ice in some cold regions.',
                            '',
                            'KEY IDEA: Light, shadow and water affect where bases are built.'
                        ]
                    },
                    {
                        title: 'PERMANENT SHADOWS',
                        lines: [
                            'Some deep lunar craters receive almost no direct sunlight.',
                            'They are permanently shadowed regions, or PSRs.',
                            'These places can become extremely cold.',
                            '',
                            'KEY IDEA: Dark craters may preserve materials such as water ice.'
                        ]
                    },
                    {
                        title: 'WATER ICE ON THE MOON',
                        lines: [
                            'Scientists have found evidence of water ice in some cold lunar regions.',
                            'Future explorers may be able to use this water.',
                            'It could support astronauts or become other useful resources.',
                            '',
                            'KEY IDEA: Local water reduces what must be carried from Earth.'
                        ]
                    },
                    {
                        title: 'LUNAR REGOLITH',
                        lines: [
                            "The Moon's surface has broken rock and dust called regolith.",
                            'Regolith was created by billions of years of impacts.',
                            'Future missions may use this local material.',
                            '',
                            'KEY IDEA: Even lunar soil may become a useful resource.'
                        ]
                    }
                ]
            },
            {
                id: 'mars',
                title: 'MARS',
                articles: [
                    {
                        title: "MARS' THIN ATMOSPHERE",
                        lines: [
                            "Mars has an atmosphere, but it is thinner than Earth's.",
                            'It is mostly carbon dioxide.',
                            'Humans cannot breathe Martian air.',
                            '',
                            'KEY IDEA: A Mars habitat must create its own safe environment.'
                        ]
                    },
                    {
                        title: 'MARTIAN DUST',
                        lines: [
                            'Fine dust covers much of Mars.',
                            'Dust can reduce sunlight reaching solar panels.',
                            'Dust can also settle on equipment.',
                            '',
                            'KEY IDEA: Mars missions need plans for dusty conditions.'
                        ]
                    },
                    {
                        title: 'A SOL',
                        lines: [
                            'A day on Mars is called a sol.',
                            'One sol lasts about 24 hours and 39 minutes.',
                            'That is only a little longer than a day on Earth.',
                            '',
                            "KEY IDEA: Mars has a familiar rhythm, but not exactly Earth's."
                        ]
                    },
                    {
                        title: 'WAITING FOR EARTH',
                        lines: [
                            'Mars is millions of kilometres away from Earth.',
                            'Radio signals travel at light speed, but the journey takes time.',
                            'A one-way message can take roughly 4 to 24 minutes.',
                            '',
                            'KEY IDEA: Mars crews cannot always wait for Earth to decide.'
                        ]
                    }
                ]
            },
            {
                id: 'space-resources',
                title: 'SPACE RESOURCES',
                articles: [
                    {
                        title: 'USING LOCAL RESOURCES',
                        lines: [
                            'ISRU means In-Situ Resource Utilization.',
                            'It means using useful materials found at the destination.',
                            'Future explorers may use local water, soil or other resources instead of bringing everything from Earth.',
                            '',
                            'KEY IDEA: Local resources make long missions more independent.'
                        ]
                    },
                    {
                        title: 'STORING ENERGY',
                        lines: [
                            'Solar panels generate electricity when sunlight reaches them.',
                            'Batteries can store energy for later.',
                            'Stored power matters during darkness, dust or emergencies.',
                            '',
                            'KEY IDEA: Producing and storing energy are both important.'
                        ]
                    }
                ]
            },
            {
                id: 'mission-safety',
                title: 'MISSION SAFETY',
                articles: [
                    {
                        title: 'WHAT COMES FIRST?',
                        lines: [
                            'In an emergency, crew safety comes first.',
                            'Astronauts identify the danger and protect the crew.',
                            'Next, they stabilize life support and power.',
                            'Science work can wait until the crew is safe.',
                            '',
                            'KEY IDEA: A mission is not only about experiments.'
                        ]
                    },
                    {
                        title: 'ENGINEERING TRADE-OFFS',
                        lines: [
                            'Space missions have limited power, water, food and time.',
                            'Using more of one resource can leave less for another system.',
                            'Engineers must choose how to use resources carefully.',
                            '',
                            'KEY IDEA: There is not always one perfect solution.'
                        ]
                    }
                ]
            }
        ];
    }

    private createSpaceLibraryFrame(title: string)
    {
        this.resetTouchInput();
        this.closeReadingPanel();

        const overlay =
            this.add.rectangle(
                this.scale.width / 2,
                this.scale.height / 2,
                this.scale.width,
                this.scale.height,
                0x05080d,
                0.76
            )
            .setDepth(300)
            .setInteractive();

        const panel =
            this.add.rectangle(
                this.scale.width / 2,
                this.scale.height / 2,
                1120,
                670,
                this.uiColors.panel,
                1
            )
            .setStrokeStyle(4, 0x66ddff)
            .setDepth(310);

        const titleText =
            this.add.text(
                this.scale.width / 2,
                75,
                title,
                {
                    fontFamily: this.headingFont,
                    fontSize: '38px',
                    color: '#ffffff'
                }
            )
            .setOrigin(0.5)
            .setDepth(312);

        const close =
            this.add.text(
                this.scale.width / 2 + 520,
                70,
                'X CLOSE',
                {
                    fontFamily: this.headingFont,
                    fontSize: '25px',
                    color: '#ffffff',
                    backgroundColor: '#8d3434',
                    padding: { x: 10, y: 7 }
                }
            )
            .setOrigin(1, 0.5)
            .setDepth(312)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.closeReadingPanel());

        this.readingPanelObjects = [overlay, panel, titleText, close];
        this.readingPanelOpen = true;
    }

    private showSpaceLibrary()
    {
        this.createSpaceLibraryFrame('SPACE LIBRARY');

        const categories = this.getSpaceLibraryCategories();

        categories.forEach((category, index) =>
        {
            const column = index % 2;
            const row = Math.floor(index / 2);
            const x = this.scale.width / 2 + (column === 0 ? -275 : 275);
            const y = 190 + row * 125;

            const button =
                this.add.rectangle(
                    x,
                    y,
                    500,
                    82,
                    0x203c50,
                    1
                )
                .setStrokeStyle(3, 0x66ddff)
                .setDepth(311)
                .setInteractive({ useHandCursor: true })
                .on(
                    'pointerdown',
                    () => this.showSpaceLibraryCategory(category.id)
                );

            const label =
                this.add.text(
                    x,
                    y,
                    `[${index + 1}] ${category.title}`,
                    {
                        fontFamily: this.headingFont,
                        fontSize: '28px',
                        color: '#ffffff'
                    }
                )
                .setOrigin(0.5)
                .setDepth(312);

            this.readingPanelObjects.push(button, label);
        });

        const back = this.createLibraryBackButton(
            '< BACK TO OUTPOST',
            () => this.closeReadingPanel()
        );
        this.readingPanelObjects.push(back);
    }

    private showSpaceLibraryCategory(id: LibraryCategoryId)
    {
        const category =
            this.getSpaceLibraryCategories()
                .find(item => item.id === id);

        if (!category)
        {
            return;
        }

        this.createSpaceLibraryFrame(category.title);

        category.articles.forEach((article, index) =>
        {
            const y = 165 + index * 100;
            const button =
                this.add.rectangle(
                    this.scale.width / 2,
                    y,
                    900,
                    68,
                    0x203c50,
                    1
                )
                .setStrokeStyle(2, 0x66ddff)
                .setDepth(311)
                .setInteractive({ useHandCursor: true })
                .on(
                    'pointerdown',
                    () => this.showSpaceLibraryArticle(id, index)
                );

            const label =
                this.add.text(
                    this.scale.width / 2 - 420,
                    y,
                    `> ${article.title}`,
                    {
                        fontFamily: this.bodyFont,
                        fontSize: '27px',
                        color: '#ffffff'
                    }
                )
                .setOrigin(0, 0.5)
                .setDepth(312);

            this.readingPanelObjects.push(button, label);
        });

        const back = this.createLibraryBackButton(
            '< BACK TO CATEGORIES',
            () => this.showSpaceLibrary()
        );
        this.readingPanelObjects.push(back);
    }

    private showSpaceLibraryArticle(
        categoryId: LibraryCategoryId,
        articleIndex: number
    )
    {
        const category =
            this.getSpaceLibraryCategories()
                .find(item => item.id === categoryId);
        const article = category?.articles[articleIndex];

        if (!category || !article)
        {
            return;
        }

        this.createSpaceLibraryFrame(article.title);

        const body =
            this.add.text(
                this.scale.width / 2,
                340,
                article.lines,
                {
                    fontFamily: this.bodyFont,
                    fontSize: '27px',
                    color: '#ffffff',
                    align: 'center',
                    lineSpacing: 11,
                    wordWrap: {
                        width: 930,
                        useAdvancedWrap: true
                    }
                }
            )
            .setOrigin(0.5)
            .setDepth(312);

        const back = this.createLibraryBackButton(
            `< BACK TO ${category.title}`,
            () => this.showSpaceLibraryCategory(categoryId)
        );

        this.readingPanelObjects.push(body, back);
    }

    private createLibraryBackButton(
        label: string,
        callback: () => void
    )
    {
        return this.add.text(
            this.scale.width / 2 - 500,
            680,
            label,
            {
                fontFamily: this.headingFont,
                fontSize: '25px',
                color: '#ffffff',
                backgroundColor: '#25445c',
                padding: { x: 16, y: 9 }
            }
        )
        .setOrigin(0, 0.5)
        .setDepth(312)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', callback);
    }

    private showReadingPanel(
        title: string,
        lines: string[],
        accentColor: number
    )
    {
        this.resetTouchInput();
        this.closeReadingPanel();

        const panelWidth =
            Math.min(
                1000,
                this.scale.width - 100
            );

        const overlay =
            this.add.rectangle(
                this.scale.width / 2,
                this.scale.height / 2,
                this.scale.width,
                this.scale.height,
                0x05080d,
                0.68
            )
            .setDepth(300)
            .setInteractive();

        const panel =
            this.add.rectangle(
                this.scale.width / 2,
                this.scale.height / 2,
                panelWidth,
                600,
                this.uiColors.panel,
                1
            )
            .setStrokeStyle(
                4,
                accentColor
            )
            .setDepth(310);

        const titleText =
            this.add.text(
                this.scale.width / 2,
                this.scale.height / 2 - 250,
                title,
                {
                    fontFamily: this.headingFont,
                    fontSize: '34px',
                    color: '#ffffff',
                    align: 'center'
                }
            )
            .setOrigin(0.5)
            .setDepth(311);

        const bodyText =
            this.add.text(
                this.scale.width / 2,
                this.scale.height / 2 - 15,
                lines,
                {
                    fontFamily: this.bodyFont,
                    fontSize: '26px',
                    color: '#ffffff',
                    align: 'center',
                    lineSpacing: 10,
                    padding: {
                        x: 34,
                        y: 20
                    },
                    wordWrap: {
                        width: panelWidth - 130,
                        useAdvancedWrap: true
                    }
                }
            )
            .setOrigin(0.5)
            .setDepth(311);

        const closeButton =
            this.add.rectangle(
                this.scale.width / 2,
                this.scale.height / 2 + 250,
                300,
                62,
                0x25445c,
                1
            )
            .setStrokeStyle(2, accentColor)
            .setDepth(311)
            .setInteractive({ useHandCursor: true })
            .on(
                'pointerdown',
                () => this.closeReadingPanel()
            );

        const closeText =
            this.add.text(
                this.scale.width / 2,
                this.scale.height / 2 + 250,
                '[X] CLOSE  •  ESC',
                {
                    fontFamily: this.headingFont,
                    fontSize: '28px',
                    color: '#ffffff'
                }
            )
            .setOrigin(0.5)
            .setDepth(312);

        const closeX =
            this.add.text(
                this.scale.width / 2 + panelWidth / 2 - 27,
                this.scale.height / 2 - 274,
                '[X]',
                {
                    fontFamily: this.headingFont,
                    fontSize: '26px',
                    color: '#ffffff',
                    backgroundColor: '#8d3434',
                    padding: {
                        x: 8,
                        y: 5
                    }
                }
            )
            .setOrigin(0.5)
            .setDepth(312)
            .setInteractive({ useHandCursor: true })
            .on(
                'pointerdown',
                () => this.closeReadingPanel()
            );

        this.readingPanelObjects = [
            overlay,
            panel,
            titleText,
            bodyText,
            closeButton,
            closeText,
            closeX
        ];

        this.readingPanelOpen = true;
    }

    private closeReadingPanel()
    {
        for (
            const gameObject of
            this.readingPanelObjects
        )
        {
            gameObject.destroy();
        }

        this.readingPanelObjects = [];
        this.readingPanelOpen = false;
    }

    // =====================================================
    // SAVE / LOAD
    // =====================================================

    private loadKnowledgeProgress()
    {
        try
        {
            const saved =
                localStorage.getItem(
                    this.codexSaveKey
                );

            if (!saved)
            {
                return new Set<KnowledgeId>();
            }

            const parsed = JSON.parse(saved);
            const validIds = new Set(
                this.getKnowledgeCards()
                    .map(card => card.id)
            );

            if (!Array.isArray(parsed))
            {
                return new Set<KnowledgeId>();
            }

            return new Set<KnowledgeId>(
                parsed.filter(
                    (id): id is KnowledgeId =>
                        typeof id === 'string' &&
                        validIds.has(id as KnowledgeId)
                )
            );
        }
        catch (error)
        {
            console.warn(
                'Space Codex progress could not be loaded:',
                error
            );

            return new Set<KnowledgeId>();
        }
    }

    private saveKnowledgeProgress()
    {
        try
        {
            localStorage.setItem(
                this.codexSaveKey,
                JSON.stringify(
                    [...this.unlockedKnowledge]
                )
            );
        }
        catch (error)
        {
            console.warn(
                'Space Codex progress could not be saved:',
                error
            );
        }
    }

    private createDefaultProgress(): PlanetProgress
    {
        return {
            solarLevel: 1,
            eclssLevel: 1,
            greenhouseLevel: 1,

            science: 0,

            bestStars: 0,
            missionsCompleted: 0
        };
    }

    private createDefaultSaveData(): SaveData
    {
        return {
            version: 1,

            Moon: this.createDefaultProgress(),
            Mars: this.createDefaultProgress()
        };
    }

    private loadSaveData(): SaveData
    {
        try
        {
            const saved =
                localStorage.getItem(
                    this.saveKey
                );

            if (!saved)
            {
                return this.createDefaultSaveData();
            }

            const parsed =
                JSON.parse(saved) as SaveData;

            if (
                !parsed ||
                parsed.version !== 1 ||
                !parsed.Moon ||
                !parsed.Mars
            )
            {
                return this.createDefaultSaveData();
            }

            return parsed;
        }
        catch (error)
        {
            console.warn(
                'Save data could not be loaded:',
                error
            );

            return this.createDefaultSaveData();
        }
    }

    private writeSaveData()
    {
        try
        {
            localStorage.setItem(
                this.saveKey,
                JSON.stringify(
                    this.saveData
                )
            );
        }
        catch (error)
        {
            console.warn(
                'Save data could not be written:',
                error
            );
        }
    }

    private loadPlanetProgress()
    {
        if (!this.selectedPlanet)
        {
            return;
        }

        const progress =
            this.saveData[
                this.selectedPlanet
            ];

        this.solarLevel =
            progress.solarLevel;

        this.eclssLevel =
            progress.eclssLevel;

        this.greenhouseLevel =
            progress.greenhouseLevel;

        this.science =
            progress.science;
    }

    private savePlanetProgress()
    {
        if (!this.selectedPlanet)
        {
            return;
        }

        const progress =
            this.saveData[
                this.selectedPlanet
            ];

        progress.solarLevel =
            this.solarLevel;

        progress.eclssLevel =
            this.eclssLevel;

        progress.greenhouseLevel =
            this.greenhouseLevel;

        progress.science =
            this.science;

        this.writeSaveData();
    }

    // =====================================================
    // RESET RUNTIME STATE
    // =====================================================

    private resetRuntimeState()
    {
        // -----------------------------------------
        // FLOW
        // -----------------------------------------

        this.selectedPlanet = null;

        this.gameStarted = false;

        this.tutorialStep = 0;
        this.tutorialComplete = false;

        this.missionLoopStarted = false;
        this.missionEnded = false;

        // -----------------------------------------
        // BASIC RESOURCES
        // -----------------------------------------

        this.power = 80;

        this.lifeSupport = 85;

        this.oxygen = 85;
        this.water = 80;
        this.co2 = 15;

        this.eclssActive = false;

        this.food = 70;
        this.crewHealth = 100;

        this.radiation = 10;

        // Science will be loaded from save later.
        this.science = 0;

        // -----------------------------------------
        // GREENHOUSE
        // -----------------------------------------

        this.greenhouseGrowing = false;
        this.greenhouseProgress = 0;

        // -----------------------------------------
        // SYSTEM STATE
        // -----------------------------------------

        this.solarReady = true;

        this.powerSystemStarted = false;
        this.foodSystemStarted = false;

        this.lowPowerWarningShown = false;
        this.foodWarningShown = false;

        this.lastLifeSupportWarning = '';

        // -----------------------------------------
        // COMMUNICATION
        // -----------------------------------------

        this.communicationPending = false;

        // -----------------------------------------
        // NASA / RADIATION
        // -----------------------------------------

        this.trainingEvent = null;

        this.radiationEmergencyActive = false;

        this.radiationScenarioScheduled = false;

        // -----------------------------------------
        // ENVIRONMENT
        // -----------------------------------------

        this.moonShadowActive = false;
        this.marsDustActive = false;

        this.environmentEventTriggered = false;

        // -----------------------------------------
        // MISSION
        // -----------------------------------------

        this.missionCycle = 1;
        this.missionTimeRemaining =
            this.missionCycleDuration;

        this.totalHarvests = 0;
        this.totalEarthMessages = 0;
        this.successfulShelters = 0;

        // -----------------------------------------
        // RESEARCH
        // -----------------------------------------

        // Levels reset first.
        // Real saved levels load after planet selection.

        this.solarLevel = 1;
        this.eclssLevel = 1;
        this.greenhouseLevel = 1;

        this.upgradeMenuOpen = false;
        this.pendingNextCycle = 1;

        // -----------------------------------------
        // TIMER REFERENCES
        // -----------------------------------------

        this.missionTimer = undefined;
        this.lifeSupportTimer = undefined;
        this.radiationTimer = undefined;

        this.upgradePanel = undefined;
        this.upgradeText = undefined;
        this.upgradeFeedbackText = undefined;
        this.upgradeTemporaryObjects = [];

        this.readingPanelOpen = false;
        this.readingPanelObjects = [];
        this.touchControlObjects = [];
    }

    // =====================================================
    // STAR DISPLAY HELPER
    // =====================================================

    private getStarDisplay(stars: number)
    {
        if (stars >= 3)
        {
            return '★★★';
        }

        if (stars === 2)
        {
            return '★★☆';
        }

        if (stars === 1)
        {
            return '★☆☆';
        }

        return '☆☆☆';
    }
}
