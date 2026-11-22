import type { DraftRequest } from '../../../draft/contract';
import { emptyPlanDocument } from '../../../model/plan';

/**
 * The seven reference stages from the MD's deck (DRRC SOF Multigun, slides 1, 3, 5, 7, 8, 10
 * and 12; spec §1). Briefs are as written; bay sizes are guesses until the MD supplies the
 * real DRRC ones (spec §9). `targets` is the TARGETS line as catalog symbols.
 */
export type EvalCase = {
	name: string;
	request: DraftRequest;
	targets: Record<string, number>;
	labels: string[];
};

const PISTOL_BAY = { widthFt: 90, depthFt: 75, unit: 'yd' as const };
const RIFLE_BAY = { widthFt: 120, depthFt: 450, unit: 'yd' as const };
const MIXED_BAY = { widthFt: 120, depthFt: 300, unit: 'yd' as const };

function stage(
	name: string,
	canvas: DraftRequest['canvas'],
	fields: Partial<DraftRequest['brief']> & { procedure: string },
	targets: Record<string, number>,
	labels: string[]
): EvalCase {
	const brief = { ...emptyPlanDocument().brief, ...fields };
	return {
		name,
		request: {
			planId: '00000000-0000-4000-8000-000000000000',
			description: brief.procedure,
			brief,
			canvas,
			symbolSize: 'medium'
		},
		targets,
		labels
	};
}

const sa = (n: number) => Array.from({ length: n }, (_, i) => `SA-${i + 1}`);

export const EVAL_CASES: EvalCase[] = [
	stage(
		'April 2026 Stage 1',
		RIFLE_BAY,
		{
			startPosition: 'Standing in start box, loaded rifle held at low ready',
			gunReady: 'Rifle held at low ready. This stage is rifle only',
			roundCount: '21rds battle rifle/37rds intermediate rifle',
			targetsOverride: '1 flash target, 4 static steel',
			parTime: '240 seconds',
			procedure:
				'On start signal, proceed to SA-1 and engage the static steel through a port in the half wall (2 hits each for intermediate rifle and 1 hit each for battle rifle) before taking 1 shot at the flasher for a 5 second bonus if hit. Repeat at SA-2 (over the barrel), SA-3 (through the pallet) and SA-4 (from the rooftop, no part of your body touching the ground). Proceed to SA-5 and engage the flasher through the tire. Final flasher engagement is scored as a HVT miss if not neutralized.'
		},
		{ flasher: 1, 'steel-static': 4 },
		sa(5)
	),
	stage(
		'April 2026 Stage 2',
		PISTOL_BAY,
		{
			startPosition: 'Seated in car',
			gunReady: 'Pistol loaded and holstered. Optional shotgun loaded in dump box.',
			roundCount: '32rds pistol (24rds if 40 S&W or larger)',
			targetsOverride: '5 poppers, 5 KDs, Double Whirly, 8 large paper',
			parTime: '240 seconds',
			procedure:
				'On start signal, exit car and engage paper arrays directly in front from SA-1 and SA-2. Proceed to SA-3 and engage steel targets from SA-3 through SA-5, engaging array directly in front of you. Steel targets can be engaged with either pistol or shotgun. If using shotgun, abandon safe pistol in dump box. 40 S&W and larger: paper targets only require 1 hit anywhere to neutralize'
		},
		{ popper: 5, 'plate-kd': 5, 'whirly-gig': 1, paper: 8 },
		sa(5)
	),
	stage(
		'April 2026 Stage 3',
		MIXED_BAY,
		{
			startPosition:
				'Seated on chopper (SA-1), rifle loaded with 15rds (intermediate cartridge) or 10rds (battle rifle). Additional rifle magazines in ammo can.',
			gunReady:
				'Rifle held at low ready. Pistol holstered cruiser ready and/or shotgun cruiser ready in dump box A.',
			roundCount: '12-20rds birdshot or pistol, 16rds battle rifle/21rds intermediate rifle',
			targetsOverride: 'Spinner, 4 poppers, Texas star, 5 static steel, flasher',
			parTime: '240 seconds',
			procedure:
				'On start signal, engage static steel while at SA-1, seated on chopper. Shooter will engage in left to right or right to left sweeps, moving on to the next target after each shot and will continue to do so until expending all rounds loaded. Sling empty rifle or place in dump box B and proceed to SA-2. Engage Texas Star and poppers through V-tac wall with secondary weapon, changing ports per hit. Proceed to the wall and engage spinner from the SA-3 (left side of the wall) and poppers from SA-4 (right side of the wall). Abandon safe secondary weapon in dump box B and retrieve rifle ammunition. From SA-5 (the dump box), engage each static steel with one hit before engaging flasher with one hit.'
		},
		{ spinner: 1, popper: 4, 'texas-star': 1, 'steel-static': 5, flasher: 1 },
		[...sa(5), 'A', 'B']
	),
	stage(
		'February 2026 Stage 2',
		{ widthFt: 120, depthFt: 150, unit: 'yd' },
		{
			startPosition: 'Standing in start box, hands relaxed at sides.',
			gunReady:
				'Rifle and shotgun cruiser ready in dump box of choice. Pistol holstered cruiser ready',
			targetsOverride:
				'2 Spinners, 6 poppers, 14 KDs, Whirly-Gig, Ducks in a Row, 14 small paper, 6 large paper',
			parTime: '60 seconds',
			procedure:
				'This is a fixed time stage. Shooters will have 60 seconds to neutralize as many targets as possible. Upon start signal, engage targets from the shooting boxes directly in front of them. Small paper is rifle only. Large paper is rifle or pistol. All steel is shooter’s choice pistol or shotgun. Guns are abandoned safe in dump box and may be retrieved and reused.',
			notes: [
				{
					id: 'bonuses',
					title: 'Bonuses per target neutralized',
					body: 'Large paper – 5 seconds\nSmall paper – 10 seconds\nPopper – 5 seconds\nKD – 10 seconds\nSpinner – 60 seconds\nDucks in a Row - 10 seconds per plate\nWhirly-Gig – 10 seconds per plate'
				}
			]
		},
		{
			spinner: 2,
			popper: 6,
			'plate-kd': 14,
			'whirly-gig': 1,
			ducks: 1,
			'paper-small': 14,
			paper: 6
		},
		[]
	),
	stage(
		'March 2025 Stage 1',
		MIXED_BAY,
		{
			startPosition: 'Seated on plank, rifle loaded with 5 rounds on safe, aimed at target.',
			gunReady:
				'Pistol holstered cruiser ready or shotgun loaded in dump box A. Additional rifle magazines in glovebox of car.',
			roundCount: '12rds pistol or birdshot, 14rds battle rifle/21rds intermediate rifle',
			targetsOverride: '8 poppers, 4 bottles, 1 flash target, 2 static steel, platerack',
			parTime: '240 seconds',
			procedure:
				'On start signal, engage platerack while seated on plank. Any plates knocked down are a 5 second bonus each. Show RO an empty rifle and abandon in dump box A or sling empty rifle. Retrieve pistol or shotgun and engage bottles through the car and poppers over the hood of the car. Proceed to wall and engage poppers through the left window and bottles through the right window. Abandon safe pistol/shotgun in dump box B, unsling or retrieve rifle and engage flashers and static steel from the dump box, while fully standing on the staircase and on top of the roof.'
		},
		{ popper: 8, bottle: 4, flasher: 1, 'steel-static': 2, 'plate-rack': 1 },
		['A', 'B']
	),
	stage(
		'March 2025 Stage 2',
		PISTOL_BAY,
		{
			startPosition: 'Standing in start box, hands relaxed at sides.',
			gunReady: 'Pistol loaded and holstered.',
			roundCount: '32rds pistol (20rds if 40 S&W or larger)',
			targetsOverride: '8 poppers, 6 large paper',
			parTime: '240 seconds',
			procedure:
				'On start signal, engage the two far right poppers before proceeding to the first shooting position. From each position, knock down one popper and fire two shots at each of the two paper targets from the array in front of you. The shooting positions are: through the barrel, through the gap in the chair, through the gap in the sawhorse, between the double barrel stacks, on the wobble platform, and under the sticks. Paper must have 4 hits each, any less are scored as an FTN per miss.'
		},
		{ popper: 8, paper: 6 },
		[]
	),
	stage(
		'March 2025 Stage 3',
		MIXED_BAY,
		{
			startPosition:
				'Standing behind wall, shotgun loaded with 5 rounds at low ready or pistol loaded with 5 rounds holstered.',
			gunReady:
				'Rifle loaded in dump box. Additional shotgun/pistol magazines start in ammo can, shotgun/pistol ammunition not in magazines (loose, clips, etc) may be on body.',
			roundCount: '10-20rds birdshot or pistol, 13rds battle rifle/26rds intermediate rifle',
			targetsOverride: 'Spinner, 2 poppers, Texas star, 4 static steel, large paper',
			parTime: '240 seconds',
			procedure:
				'On start signal, engage star from left side of the wall and poppers from the right side. Proceed to shooting box and engage spinner before abandoning a safe shotgun/pistol in dump box. Kick down popper, retrieve rifle and engage swinging paper from box (1 hit battle rifle, standard scoring for intermediate rifle). Draw sequence from bucket and engage static steel from above the table, below the table, and over the barrel according to the drawn sequence. Hits out of sequence do not count.'
		},
		{ spinner: 1, popper: 2, 'texas-star': 1, 'steel-static': 4, swinger: 1 },
		[]
	)
];
