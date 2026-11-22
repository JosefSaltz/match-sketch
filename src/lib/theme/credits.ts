/** Where each theme's reference image (and the display font) came from. */
export type Credit = {
	id: string;
	title: string;
	author: string;
	license: string;
	/** The source's page, when it has one; user-supplied references don't. */
	url?: string;
	note?: string;
};

/** Required wording when using material under the UK Open Government Licence. */
export const OGL_STATEMENT =
	'Contains public sector information licensed under the Open Government Licence v1.0';

const USER_SUPPLIED = 'Reference supplied by the site owner';

export const CREDITS: readonly Credit[] = [
	{
		id: 'dpm',
		title: 'Woodland DPM (Soldier 95) fabric photo',
		author: 'Cpl Adrian Harlen RLC, UK Ministry of Defence',
		license: 'Open Government Licence v1.0',
		url: 'https://commons.wikimedia.org/wiki/File:DPM_Combat_95_Camouflage_Material_MOD_45149982.jpg',
		note: OGL_STATEMENT
	},
	{
		id: 'm81',
		title: 'Brown-dominant ERDL swatch (the basis of M81 Woodland)',
		author: 'Wikimedia Commons, credited to the US Army ERDL',
		license: 'Public domain (as tagged on Commons)',
		url: 'https://commons.wikimedia.org/wiki/File:Brown-dominant_%22highland%22_ERDL_camouflage_pattern_swatch.png'
	},
	{
		id: 'erdl',
		title: 'Green-dominant ERDL swatch',
		author: 'Wikimedia Commons, credited to the US Army ERDL',
		license: 'Public domain (as tagged on Commons)',
		url: 'https://commons.wikimedia.org/wiki/File:Green-dominant_%22lowland%22_ERDL_camouflage_pattern_swatch.png'
	},
	{
		id: 'dcu',
		title: '3-Color Desert (DCU) swatch',
		author: 'Wikimedia Commons, credited to the US Army',
		license: 'Public domain (as tagged on Commons)',
		url: 'https://commons.wikimedia.org/wiki/File:DCU_camo_swatch.png'
	},
	{
		id: 'tiger-stripe',
		title: 'Tiger Stripe reference',
		author: USER_SUPPLIED,
		license: 'Unknown'
	},
	{
		id: 'dbdu',
		title: 'Chocolate Chip (6-color desert) reference',
		author: USER_SUPPLIED,
		license: 'Unknown'
	},
	{
		id: 'desert-night',
		title: 'Desert Night Camouflage fabric photo',
		author: USER_SUPPLIED,
		license: 'Unknown'
	},
	{
		id: 'font-graduate',
		title: 'Graduate typeface',
		author: 'Eduardo Tunni',
		license: 'SIL Open Font License 1.1',
		url: 'https://fontsource.org/fonts/graduate'
	}
];
