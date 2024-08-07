import {
	generateIconStaticCSS,
	generateIconVariableCSS,
	generateV1CSS,
	generateV2CSS,
	generateVariableCSS,
} from '@fontsource-utils/cli';
import type { IDResponse, VariableMetadata } from 'common-api/types';
import { StatusError } from 'itty-router';

import { generateVariableVariants } from './util';

const CSS_TTL = 60 * 60 * 24; // 1 day

export const makeFontFilePath = (
	tag: string,
	subset: string,
	weight: string,
	style: string,
	extension: string,
) => {
	// We need to replace square brackets with empty spaces
	return `https://cdn.jsdelivr.net/fontsource/fonts/${tag}/${subset}-${weight}-${style}.${extension}`
		.replace('[', '')
		.replace(']', '');
};

export const makeFontFileVariablePath = (
	tag: string,
	subset: string,
	axes: string,
	style: string,
) => {
	return `https://cdn.jsdelivr.net/fontsource/fonts/${tag}/${subset}-${axes}-${style}.woff2`
		.replace('[', '')
		.replace(']', '');
};

const keyGen = (tag: string, filename: string) => `${tag}:${filename}`;
const keyGenV = (tag: string, filename: string) =>
	`variable:${tag}:${filename}`;

export const updateCss = async (
	tag: string,
	file: string,
	metadata: IDResponse,
	env: Env,
	ctx: ExecutionContext,
): Promise<string> => {
	let css: string | undefined;
	const { category, type } = metadata;

	// Icons are handled differently
	if (category === 'icons' && type === 'google') {
		// Static
		const cssGenerate = generateIconStaticCSS(metadata, makeFontFilePath, tag);
		for (const item of cssGenerate) {
			// Cache return value early as KV has slow writes
			if (item.filename === file) {
				css = item.css;

				ctx.waitUntil(
					env.CSS.put(keyGen(tag, item.filename), item.css, {
						metadata: {
							ttl: Date.now() / 1000 + CSS_TTL,
						},
					}),
				);
			}
		}
	} else {
		const cssGenerate = [
			...generateV1CSS(metadata, makeFontFilePath, tag),
			...generateV2CSS(metadata, makeFontFilePath, tag),
		];

		for (const item of cssGenerate) {
			// Cache return value early as KV has slow writes
			if (item.filename === file) {
				css = item.css;

				ctx.waitUntil(
					env.CSS.put(keyGen(tag, item.filename), item.css, {
						metadata: {
							ttl: Date.now() / 1000 + CSS_TTL,
						},
					}),
				);
			}
		}
	}

	if (!css) {
		throw new StatusError(404, 'Not Found. Unable to find filename.');
	}

	return css;
};

export const updateVariableCSS = async (
	id: string,
	version: string,
	file: string,
	metadata: IDResponse,
	variableMeta: VariableMetadata,
	env: Env,
	ctx: ExecutionContext,
): Promise<string> => {
	let css: string | undefined;
	const { category, type } = metadata;
	const tag = `${id}@${version}`;
	const vfTag = `${id}:vf@${version}`;

	const generateMeta = {
		id,
		...generateVariableVariants(metadata, variableMeta),
	};

	// Icons are handled differently
	if (category === 'icons' && type === 'google') {
		const cssGenerate = generateIconVariableCSS(
			generateMeta,
			makeFontFileVariablePath,
			vfTag,
		);
		for (const item of cssGenerate) {
			// Reject index.css for variable fonts
			if (item.filename === 'index.css') {
				continue;
			}

			if (item.filename === file) {
				css = item.css;

				ctx.waitUntil(
					env.CSS.put(keyGenV(tag, item.filename), item.css, {
						metadata: {
							ttl: Date.now() / 1000 + CSS_TTL,
						},
					}),
				);
			}
		}
	} else {
		const cssGenerate = generateVariableCSS(
			metadata,
			generateMeta,
			makeFontFileVariablePath,
			vfTag,
		);
		for (const item of cssGenerate) {
			// Reject index.css for variable fonts
			if (item.filename === 'index.css') {
				continue;
			}

			if (item.filename === file) {
				css = item.css;

				ctx.waitUntil(
					env.CSS.put(keyGenV(tag, item.filename), item.css, {
						metadata: {
							ttl: Date.now() / 1000 + CSS_TTL,
						},
					}),
				);
			}
		}
	}

	if (!css) {
		throw new StatusError(440, 'Not Found. Unable to find filename.');
	}

	return css;
};
