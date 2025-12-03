import { showAlert } from "/components/alert/alert.js";

window.addEventListener("load", () => {
    const fields = {
        blockName: "text",
        hardness: "number",
        explosionResistance: "number",
        lightLevel: "number",
        noOcclusion: "checkbox",
        isViewBlocking: "checkbox",
        isRedstoneConductor: "checkbox",
        emissiveRendering: "checkbox",
        dynamicShape: "checkbox",
        requiresCorrectToolForDrops: "checkbox",
        friction: "number",
        speedFactor: "number",
        jumpFactor: "number",
        randomTicks: "checkbox",
        noLootTable: "checkbox",
        dropsLike: "text",
        lootFrom: "text",
        isSolid: "checkbox",
        sound: "text",
        material: "text",
        noCollision: "checkbox",
        isSuffocating: "checkbox",
        isValidSpawn: "checkbox",
        isPathfindable: "checkbox",
        offset: "number",
        offsetFunction: "text",
        instantBreak: "checkbox",
        noDrops: "checkbox",
        creativeTabName: "text"
    };

    const generateBlockButton = document.getElementById("generateBlock");

    generateBlockButton.addEventListener("click", () => {

        const values = {};

        // --- Récupération des valeurs ---
        Object.keys(fields).forEach(key => {
            const input = document.getElementById(key);
            const type = fields[key];

            if (type === "text") {
                if (input.value.trim() !== "") values[key] = input.value.trim();
            }

            else if (type === "number") {
                if (input.value.trim() !== "") values[key] = parseFloat(input.value);
            }

            else if (type === "checkbox") {
                if (input.checked) values[key] = true;
            }
        });

        // --- Vérification obligatoire : blockName ---
        if (!values.blockName) {
            showAlert("Vous devez renseigner un nom de bloc !");
            return;
        }

        // --- Génération du code Java ---
        const zoneBlock = document.getElementById("codeBlock");
        const zoneForgeBlock = document.getElementById("codeForgeBlock");
        const zoneForgeItem = document.getElementById("codeForgeItem");
        const zoneTab = document.getElementById("codeTab");
        const container = document.getElementById("generatedCodes");

        const blockCode = generateBlockCode(values);
        const forgeCodeBlock = generateForgeBlockRegistrations(values);
        const forgeCodeItem = generateForgeBlockItemRegistrations(values);
        const tabCode = generateCreativeTab(values);

        zoneBlock.textContent = blockCode;
        zoneForgeBlock.textContent = forgeCodeBlock;
        zoneForgeItem.textContent = forgeCodeItem;
        zoneTab.textContent = tabCode || "Pas de Creative Tab spécifié.";

        container.classList.remove("hidden");
        container.classList.add("show");
    });

    // ---------------------------------------------------
    //         FONCTION DE GÉNÉRATION DU CODE JAVA
    // ---------------------------------------------------
    function generateBlockCode(values) {

        let code = "";
        const name = values.blockName;

        code += `public class ${capitalize(name)} extends Block {\n\n`;
        code += `    public ${capitalize(name)}() {\n`;
        code += `        super(Properties.of(${values.material ?? "Material.STONE"})`;

        // Options dans le constructeur Properties
        if (values.hardness || values.explosionResistance) {
            code += `.strength(${values.hardness ?? 1.0}f, ${values.explosionResistance ?? 1.0}f)`;
        }
        if (values.lightLevel) {
            code += `.lightLevel(s -> ${values.lightLevel})`;
        }
        if (values.noOcclusion) {
            code += `.noOcclusion()`;
        }
        if (values.noCollision) {
            code += `.noCollission()`;
        }
        if (values.requiresCorrectToolForDrops) {
            code += `.requiresCorrectToolForDrops()`;
        }
        if (values.dynamicShape) {
            code += `.dynamicShape()`;
        }
        if (values.emissiveRendering) {
            code += `.emissiveRendering((a,b,c) -> true)`;
        }
        if (values.randomTicks) {
            code += `.randomTicks()`;
        }
        if (values.instantBreak) {
            code += `.instabreak()`;
        }

        // FIN super(Properties)
        code += `);\n    }\n`;

        // Méthodes supplémentaires
        if (values.friction) {
            code += `\n    @Override\n    public float getFriction() { return ${values.friction}f; }\n`;
        }
        if (values.speedFactor) {
            code += `\n    @Override\n    public float getSpeedFactor() { return ${values.speedFactor}f; }\n`;
        }
        if (values.jumpFactor) {
            code += `\n    @Override\n    public float getJumpFactor() { return ${values.jumpFactor}f; }\n`;
        }
        if (values.isSolid) {
            code += `\n    @Override\n    public boolean isSolid() { return true; }\n`;
        }
        if (values.sound) {
            code += `\n    @Override\n    public SoundType getSoundType() { return ${values.sound}; }\n`;
        }
        if (values.isViewBlocking) {
            code += `\n    @Override\n    public boolean isViewBlocking() { return true; }\n`;
        }
        if (values.isRedstoneConductor) {
            code += `\n    @Override\n    public boolean isRedstoneConductor() { return true; }\n`;
        }
        if (values.isSuffocating) {
            code += `\n    @Override\n    public boolean isSuffocating() { return true; }\n`;
        }
        if (values.isValidSpawn) {
            code += `\n    @Override\n    public boolean isValidSpawn() { return true; }\n`;
        }
        if (values.isPathfindable) {
            code += `\n    @Override\n    public boolean isPathfindable() { return true; }\n`;
        }
        if (values.offset) {
            code += `\n    @Override\n    public float getOffset() { return ${values.offset}f; }\n`;
        }
        if (values.offsetFunction) {
            code += `\n    // Fonction d'offset personnalisée\n    public float ${values.offsetFunction}(BlockState state) {\n        return 0.0f; // À modifier\n    }\n`;
        }
        if (values.noDrops) {
            code += `\n    @Override\n    public List<ItemStack> getDrops() { return List.of(); }\n`;
        }
        if (values.noLootTable) {
            code += `\n    @Override\n    protected @Nullable ResourceLocation getLootTable() { return null; }\n`;
        }
        if (values.dropsLike) {
            code += `\n    // Le bloc drop comme : ${values.dropsLike}\n`;
        }
        if (values.lootFrom) {
            code += `\n    // Le bloc utilise la loot table de : ${values.lootFrom}\n`;
        }
        code += `}\n`;
        return code;
    }

    document.querySelectorAll(".copy-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const targetId = btn.getAttribute("data-target");
            const text = document.getElementById(targetId).textContent;

            navigator.clipboard.writeText(text).then(() => {
                btn.textContent = "✔ Copié !";
                setTimeout(() => btn.textContent = "💾 Copier", 1500);
            });
        });
    });


    function generateForgeBlockRegistrations(values) {
        const nameUp = capitalize(values.blockName);
        const name = values.blockName.toLowerCase();

        return `public class ModBlocks {

    public static final DeferredRegister<Block> BLOCKS =
            DeferredRegister.create(ForgeRegistries.BLOCKS, MyMod.MODID);

    public static final RegistryObject<Block> ${name.toUpperCase()} =
            BLOCKS.register("${name}", 
                () -> new ${nameUp}());
}`;
    }

    function generateForgeBlockItemRegistrations(values) {
        const nameUp = capitalize(values.blockName);
        const name = values.blockName.toLowerCase();

        return `public class ModItems {

    public static final DeferredRegister<Item> ITEMS =
            DeferredRegister.create(ForgeRegistries.ITEMS, MyMod.MODID);

    public static final RegistryObject<Item> ${name.toUpperCase()} =
            ITEMS.register("${name}", () -> new BlockItem(ModBlocks.${name.toUpperCase()}.get(), new Item.Properties()));
}`;

    }

    function generateCreativeTab(values) {
        if (!values.creativeTabName) return "";

        const name = values.blockName.toLowerCase();
        const tab = values.creativeTabName.toLowerCase();

        return `public class ModCreativeTabs {

    public static final RegistryObject<CreativeModeTab> ${tab.toUpperCase()} =
        CREATIVE_MODE_TABS.register("${tab}",
            () -> CreativeModeTab.builder()
                .icon(() -> new ItemStack(ModBlocks.${name.toUpperCase()}.get()))
                .title(Component.translatable("creativetab.${tab}"))
                .displayItems((params, output) -> {
                    output.accept(ModBlocks.${name.toUpperCase()}.get());
                }).build());
}`;
    }

    function capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
});