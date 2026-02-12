const { defineConfig } = require("eslint/config");
const stylisticTs = require("@stylistic/eslint-plugin");
const typescriptEslint = require("@typescript-eslint/eslint-plugin");
const tsParser = require("@typescript-eslint/parser");

module.exports = defineConfig([{
    files: ["src/**/*.ts"],

    plugins: {
        "@stylistic/ts": stylisticTs,
        "@typescript-eslint": typescriptEslint,
    },

    languageOptions: {
        parser: tsParser,
        ecmaVersion: 6,
        sourceType: "module",
    },

    rules: {
        "@stylistic/ts/semi": "warn",
        "@typescript-eslint/naming-convention": [
            "warn",
            {
                selector: "default",
                format: ["camelCase"],
            },
            {
                selector: "variable",
                format: ["camelCase", "UPPER_CASE"],
                modifiers: ["const"],
            },
            {
                selector: "parameter",
                format: ["camelCase"],
                leadingUnderscore: "allow",
            },
            {
                selector: "typeLike",
                format: ["PascalCase"],
            },
            {
                selector: "enumMember",
                format: ["UPPER_CASE"],
            },
            {
                selector: "import",
                format: ["camelCase", "PascalCase"],
                modifiers: ["default"],
            },
        ],
        curly: "warn",
        eqeqeq: "warn",
        "no-throw-literal": "warn",
        semi: "off",
    },
}]);
