import typescriptEslint from "@typescript-eslint/eslint-plugin";
import pug from "eslint-plugin-pug";
import css from "eslint-plugin-css";
import tsParser from "@typescript-eslint/parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

export default [{
    ignores: [
        "**/*.css",
        "**/*.scss",
        "**/.eslintrc.js",
        "dist/*",
        "**/dist/*",
        "**/*.css",
        "**/*.scss",
    ],
}, ...compat.extends(
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:css/recommended",
), {
    plugins: {
        "@typescript-eslint": typescriptEslint,
        pug,
        css,
    },

    languageOptions: {
        parser: tsParser,
        ecmaVersion: 5,
        sourceType: "module",

        parserOptions: {
            tsconfigRootDir: "/Users/andrzej-kodify/projects/stuntman-monorepo",
            extraFileExtensions: [".css", ".pug"],
        },
    },

    rules: {
        "no-console": "error",
        "consistent-return": "error",
        "@typescript-eslint/no-explicit-any": "off",
    },
}];