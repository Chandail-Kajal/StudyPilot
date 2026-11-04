import os
import json
import random
import secrets
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
import httpx
from ai_provider import ai_manager, extract_clean_json

# Models to try for Gemini
GEMINI_MODELS = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro"]

def get_api_key(provided_key: Optional[str] = None) -> Optional[str]:
    """Retrieve Gemini or OpenAI API key from request, environment, or config."""
    if provided_key and provided_key.strip():
        return provided_key.strip()
    return (
        os.environ.get("GEMINI_API_KEY")
        or os.environ.get("GOOGLE_API_KEY")
        or os.environ.get("OPENAI_API_KEY")
    )

def is_openai_key(key: str) -> bool:
    return key.startswith("sk-")

# -------------------------------------------------------------
# LLM Integration Helpers (Gemini & OpenAI)
# -------------------------------------------------------------

async def call_gemini(prompt: str, api_key: str, system_instruction: str = "", json_mode: bool = False) -> str:
    """Call Google Gemini API using REST with httpx."""
    headers = {"Content-Type": "application/json"}
    
    # Try preferred models in order
    for model_name in GEMINI_MODELS:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
        
        body: Dict[str, Any] = {
            "contents": [
                {
                    "parts": [{"text": prompt}]
                }
            ],
            "generationConfig": {
                "temperature": 0.4,
                "topP": 0.95,
                "maxOutputTokens": 8192,
            }
        }
        
        if json_mode:
            body["generationConfig"]["responseMimeType"] = "application/json"
            
        if system_instruction:
            body["systemInstruction"] = {
                "parts": [{"text": system_instruction}]
            }

        try:
            async with httpx.AsyncClient(timeout=45.0) as client:
                res = await client.post(url, headers=headers, json=body)
                if res.status_code == 200:
                    data = res.json()
                    candidates = data.get("candidates", [])
                    if candidates and "content" in candidates[0]:
                        parts = candidates[0]["content"].get("parts", [])
                        if parts:
                            return parts[0].get("text", "")
                else:
                    # Continue to try fallback model if error
                    continue
        except Exception:
            continue
            
    raise RuntimeError("Failed to generate content from Gemini API")

async def call_openai(prompt: str, api_key: str, system_instruction: str = "", json_mode: bool = False) -> str:
    """Call OpenAI compatible API using httpx."""
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    }
    messages = []
    if system_instruction:
        messages.append({"role": "system", "content": system_instruction})
    messages.append({"role": "user", "content": prompt})

    body: Dict[str, Any] = {
        "model": "gpt-4o-mini",
        "messages": messages,
        "temperature": 0.4,
    }
    if json_mode:
        body["response_format"] = {"type": "json_object"}

    async with httpx.AsyncClient(timeout=30.0) as client:
        res = await client.post("https://api.openai.com/v1/chat/completions", headers=headers, json=body)
        if res.status_code != 200:
            raise RuntimeError(f"OpenAI API Error: {res.text}")
        data = res.json()
        return data["choices"][0]["message"]["content"]

async def call_llm(prompt: str, api_key: Optional[str] = None, system_instruction: str = "", json_mode: bool = False) -> Optional[str]:
    """Universal dispatcher: Gemini (Primary) -> Groq (Secondary) -> Ollama (Local) -> Heuristics."""
    key = get_api_key(api_key)
    if key and is_openai_key(key):
        try:
            return await call_openai(prompt, key, system_instruction, json_mode)
        except Exception as e:
            print(f"[AI Service Warning] OpenAI call failed: {e}. Falling back to AI Service Manager.")

    res = await ai_manager.call_llm(
        prompt=prompt,
        system_instruction=system_instruction,
        json_mode=json_mode,
        user_key=key
    )
    if res.get("success") and res.get("text"):
        return res["text"]
    return None

# -------------------------------------------------------------
# High-Fidelity Heuristic AI Engine (Knowledge Base for Fallback)
# -------------------------------------------------------------

MOCK_QUESTION_BANK: Dict[str, List[Dict[str, Any]]] = {
    "rotational motion": [
        {
            "question": "A solid cylinder and a hollow cylinder of the same mass and radius roll down an inclined plane without slipping. Which reaches the bottom first?",
            "options": ["The solid cylinder", "The hollow cylinder", "Both reach at the same time", "Depends on the angle of inclination"],
            "correct_answer": 0,
            "explanation": "The solid cylinder has a lower moment of inertia (I = 1/2 MR²) compared to the hollow cylinder (I = MR²), so less gravitational potential energy is converted to rotational kinetic energy and more to translational kinetic energy."
        },
        {
            "question": "What happens to the angular velocity of a spinning ice skater when she pulls her arms in?",
            "options": ["Decreases due to friction", "Remains unchanged", "Increases to conserve angular momentum", "Drops to zero immediately"],
            "correct_answer": 2,
            "explanation": "By pulling in her arms, her moment of inertia decreases (I = Σ mr²). Since angular momentum L = Iω is conserved in the absence of net external torque, ω must increase."
        },
        {
            "question": "The work-energy theorem for rotational motion states that net work done by external torques equals:",
            "options": ["Change in linear momentum", "Change in rotational kinetic energy (1/2 Iω²)", "Total potential energy", "Angular impulse"],
            "correct_answer": 1,
            "explanation": "W_net = ΔK_rot = 1/2 I (ω_final² - ω_initial²), analogous to work-energy in linear mechanics."
        },
        {
            "question": "A uniform thin rod of length L and mass M is pivoted at its center. What is its moment of inertia about a perpendicular axis through the center?",
            "options": ["(1/12) M L²", "(1/3) M L²", "(1/2) M L²", "M L²"],
            "correct_answer": 0,
            "explanation": "By integrating dm * x² from -L/2 to L/2, I = (1/12) M L². If pivoted at one end, the parallel axis theorem gives (1/3) M L²."
        },
        {
            "question": "For a rigid body rolling without slipping on a horizontal surface, what is the instantaneous velocity of the contact point with the ground?",
            "options": ["Zero", "Equal to the center-of-mass velocity v_cm", "2 * v_cm", "v_cm / 2"],
            "correct_answer": 0,
            "explanation": "In pure rolling, the instantaneous point of contact with the stationary ground is at rest (v = v_cm - Rω = 0, since v_cm = Rω)."
        },
        {
            "question": "Which physical quantity represents the rotational analogue of mass in translational mechanics?",
            "options": ["Torque", "Angular momentum", "Moment of inertia", "Angular acceleration"],
            "correct_answer": 2,
            "explanation": "Moment of inertia (I) measures rotational inertia (resistance to angular acceleration), exactly analogous to mass (m) in translational motion (F = ma vs τ = Iα)."
        }
    ],
    "electrostatics": [
        {
            "question": "According to Gauss's Law, what is the net electric flux through a closed surface enclosing zero net charge?",
            "options": ["Zero", "Proportional to surface area", "Infinity", "Depends on the dielectric constant only"],
            "correct_answer": 0,
            "explanation": "Gauss's law states Φ = Q_enclosed / ε₀. If Q_enclosed = 0, then the net outward flux through the Gaussian surface is zero."
        },
        {
            "question": "What is the electric field inside a charged isolated spherical conductor in electrostatic equilibrium?",
            "options": ["Uniform and non-zero", "Directly proportional to radius r", "Zero everywhere inside", "Inversely proportional to r²"],
            "correct_answer": 2,
            "explanation": "In electrostatic equilibrium, excess charges reside entirely on the outer surface, and the electric field within the conductor's bulk is strictly zero."
        },
        {
            "question": "If a dielectric slab with dielectric constant κ is inserted between the plates of an isolated charged capacitor, what happens to the electric potential difference?",
            "options": ["Increases by factor κ", "Decreases by factor 1/κ", "Remains unchanged", "Drops to zero"],
            "correct_answer": 1,
            "explanation": "For an isolated capacitor, charge Q remains constant. Capacitance increases (C' = κC), so V' = Q / C' = V / κ (decreases by 1/κ)."
        },
        {
            "question": "What is the relationship between electric field E and electrostatic potential V in one dimension?",
            "options": ["E = dV/dx", "E = - dV/dx", "E = ∫ V dx", "E = V * x"],
            "correct_answer": 1,
            "explanation": "Electric field is the negative spatial gradient of potential: E = - dV/dx. The negative sign indicates E points in the direction of steepest decreasing potential."
        },
        {
            "question": "How much work is required to move an electric test charge q along an equipotential surface?",
            "options": ["Zero", "q * V", "1/2 q V²", "q * E * d"],
            "correct_answer": 0,
            "explanation": "Work W = q * ΔV. On an equipotential surface, potential is identical at all points (ΔV = 0), so W = 0."
        }
    ],
    "thermodynamics": [
        {
            "question": "In an adiabatic expansion of an ideal gas, which quantity remains strictly zero?",
            "options": ["Work done (W)", "Heat exchange (Q)", "Change in internal energy (ΔU)", "Change in temperature (ΔT)"],
            "correct_answer": 1,
            "explanation": "By definition, an adiabatic process involves no heat exchange between the system and its surroundings (Q = 0). Thus, ΔU = -W."
        },
        {
            "question": "What is the theoretical maximum efficiency of a heat engine operating between temperatures T_H and T_C?",
            "options": ["1 - T_C / T_H", "T_H / T_C - 1", "1 - T_H / T_C", "(T_H - T_C) / T_C"],
            "correct_answer": 0,
            "explanation": "Carnot efficiency η = 1 - (T_C / T_H), where temperatures are expressed in Kelvin."
        },
        {
            "question": "For an ideal gas undergoing an isothermal process, the internal energy change ΔU is:",
            "options": ["Positive", "Negative", "Zero", "Dependent on pressure only"],
            "correct_answer": 2,
            "explanation": "Internal energy of an ideal gas is a function solely of temperature (U = n C_v T). Since temperature is constant in an isothermal process (ΔT = 0), ΔU = 0."
        },
        {
            "question": "According to the Clausius statement of the Second Law of Thermodynamics, heat cannot spontaneously flow from:",
            "options": ["A colder body to a hotter body", "A hotter body to a colder body", "A system at high pressure to low pressure", "A gas to a liquid"],
            "correct_answer": 0,
            "explanation": "Clausius: It is impossible to construct a device whose sole effect is the transfer of heat from a cooler reservoir to a hotter reservoir without external work input."
        },
        {
            "question": "In an isobaric expansion of a monoatomic ideal gas, what fraction of total heat added is converted into work done?",
            "options": ["2/5", "3/5", "1/2", "1/3"],
            "correct_answer": 0,
            "explanation": "For a monoatomic gas: Cp = 5/2 R, Cv = 3/2 R. Heat Q = n Cp ΔT. Work W = P ΔV = n R ΔT. Thus W / Q = R / (5/2 R) = 2/5 (40%)."
        }
    ],
    "ray optics": [
        {
            "question": "What condition must be satisfied for total internal reflection to occur?",
            "options": [
                "Light travels from rarer to denser medium with angle > critical angle",
                "Light travels from denser to rarer medium with angle of incidence greater than the critical angle",
                "Angle of incidence is exactly 90 degrees in any medium",
                "Both media have identical refractive indices"
            ],
            "correct_answer": 1,
            "explanation": "Total internal reflection occurs when light travels from an optically denser to a rarer medium and the incidence angle exceeds arcsin(n2/n1)."
        },
        {
            "question": "According to the Lens Maker's Formula, the focal length f of a thin lens in air is given by:",
            "options": [
                "1/f = (n - 1) * (1/R1 - 1/R2)",
                "1/f = (n + 1) * (1/R1 + 1/R2)",
                "f = n * (R1 - R2)",
                "1/f = n / (R1 * R2)"
            ],
            "correct_answer": 0,
            "explanation": "The lens maker's equation is 1/f = (n - 1) * (1/R1 - 1/R2), where R1 and R2 are radii of curvature adopting standard Cartesian sign conventions."
        },
        {
            "question": "When a ray of white light passes through a glass triangular prism, which color undergoes the maximum deviation?",
            "options": ["Red", "Yellow", "Violet", "Green"],
            "correct_answer": 2,
            "explanation": "By Cauchy's dispersion formula, refractive index n is highest for shorter wavelengths (violet). Greater n causes maximum angle of deviation δ."
        }
    ],
    "reaction mechanisms": [
        {
            "question": "Which of the following is characteristic of an SN2 reaction mechanism?",
            "options": [
                "Two-step mechanism with carbocation intermediate",
                "Concerted bimolecular mechanism with complete stereochemical inversion (Walden inversion)",
                "Favored in tertiary alkyl halides",
                "Racemization of chiral centers"
            ],
            "correct_answer": 1,
            "explanation": "SN2 is a single-step concerted process where nucleophilic attack occurs from the backside opposite to the leaving group, causing inversion of configuration."
        },
        {
            "question": "In nucleophilic acyl substitution, which is typically the best leaving group?",
            "options": ["Chloride ion (Cl⁻)", "Hydroxide (OH⁻)", "Alkoxide (RO⁻)", "Amide (NH₂⁻)"],
            "correct_answer": 0,
            "explanation": "Chloride is the conjugate base of a very strong acid (HCl, pKa ~ -7), making it a stable, weak base and the best leaving group."
        },
        {
            "question": "Which carbocation possesses the greatest thermodynamic stability due to hyperconjugation and resonance?",
            "options": ["Tertiary benzyl carbocation", "Primary ethyl carbocation", "Secondary propyl carbocation", "Methyl carbocation"],
            "correct_answer": 0,
            "explanation": "A tertiary benzyl carbocation benefits from extensive allylic/benzylic pi-electron delocalization across the aromatic ring plus inductive/hyperconjugative stabilization from alkyl groups."
        },
        {
            "question": "According to Zaitsev's rule, what is the major alkene product in an E2 elimination of 2-bromobutane with ethoxide base?",
            "options": ["1-butene", "trans-2-butene", "cis-2-butene", "cyclobutane"],
            "correct_answer": 1,
            "explanation": "E2 elimination with a non-bulky base follows Zaitsev's rule: the more substituted, thermodynamically more stable trans-2-butene is the major product."
        }
    ],
    "stereochemistry": [
        {
            "question": "Molecules that are non-superimposable mirror images of each other are called:",
            "options": ["Diastereomers", "Enantiomers", "Constitutional isomers", "Conformational isomers"],
            "correct_answer": 1,
            "explanation": "Enantiomers are stereoisomers that are chiral, non-superimposable mirror images with opposite optical activity."
        },
        {
            "question": "A meso compound is characterized by having stereocenters and:",
            "options": [
                "An internal plane of symmetry making it optically inactive (achiral)",
                "High optical rotation ([α] > 100°)",
                "Non-superimposable mirror images",
                "Absence of chiral carbons"
            ],
            "correct_answer": 0,
            "explanation": "A meso compound contains multiple stereocenters yet is superimposable on its mirror image due to an internal symmetry plane or center of inversion, rendering it achiral and optically inactive."
        },
        {
            "question": "According to the Cahn-Ingold-Prelog (CIP) priority rules, which substituent has highest priority?",
            "options": ["-OH", "-CH2OH", "-COOH", "-NH2"],
            "correct_answer": 0,
            "explanation": "Priority is determined primarily by atomic number of the directly attached atom: Oxygen (Z=8) outranks Nitrogen (Z=7) and Carbon (Z=6). Between -OH and -CH2OH, the attached atom is O vs C, so -OH wins."
        }
    ],
    "named reactions": [
        {
            "question": "Which reaction involves the condensation of an enolizable aldehyde/ketone with another carbonyl in basic media to yield a β-hydroxy carbonyl?",
            "options": ["Aldol reaction", "Cannizzaro reaction", "Diels-Alder reaction", "Clemmensen reduction"],
            "correct_answer": 0,
            "explanation": "The Aldol reaction proceeds via enolate formation attacking an electrophilic carbonyl to yield a β-hydroxy aldehyde or ketone (aldol)."
        },
        {
            "question": "The Cannizzaro reaction occurs specifically for aldehydes that:",
            "options": [
                "Lack alpha-hydrogens (e.g., benzaldehyde, formaldehyde)",
                "Contain at least two alpha-hydrogens",
                "Are aromatic ketones",
                "Have ester linkages"
            ],
            "correct_answer": 0,
            "explanation": "Aldehydes lacking α-hydrogens cannot form enolates in strong alkali; instead, they undergo redox disproportionation (Cannizzaro reaction) to give an alcohol and a carboxylate."
        }
    ],
    "limits and continuity": [
        {
            "question": "What is the limit of (sin x) / x as x approaches 0?",
            "options": ["0", "1", "Infinity", "Undefined"],
            "correct_answer": 1,
            "explanation": "By L'Hôpital's Rule or geometric proof using the squeeze theorem, lim (x->0) (sin x / x) = cos(0) / 1 = 1."
        },
        {
            "question": "A function f(x) is continuous at x = c if and only if:",
            "options": [
                "f(c) is defined only",
                "lim (x->c) f(x) exists and equals f(c)",
                "f'(c) exists",
                "f(x) has no horizontal asymptotes"
            ],
            "correct_answer": 1,
            "explanation": "Continuity at c requires: 1) f(c) exists, 2) lim x->c f(x) exists, and 3) the limit equals f(c)."
        },
        {
            "question": "What is the value of lim (x->0) (1 - cos x) / x²?",
            "options": ["0", "1/2", "1", "2"],
            "correct_answer": 1,
            "explanation": "Applying L'Hôpital's rule twice: lim (x->0) sin(x)/(2x) = lim (x->0) cos(x)/2 = 1/2."
        },
        {
            "question": "According to the Intermediate Value Theorem (IVT), if f is continuous on [a, b] and f(a) * f(b) < 0, then:",
            "options": [
                "There exists at least one root c in (a, b) such that f(c) = 0",
                "f'(c) = 0 for some c in (a, b)",
                "f is monotonic on [a, b]",
                "f has a discontinuity at (a+b)/2"
            ],
            "correct_answer": 0,
            "explanation": "Since f(a) and f(b) have opposite signs and f is continuous, by IVT the curve must cross the x-axis, guaranteeing at least one c in (a, b) where f(c) = 0."
        }
    ],
    "integration by parts": [
        {
            "question": "The formula for integration by parts is derived from which differential calculus rule?",
            "options": ["Chain rule", "Product rule", "Quotient rule", "Power rule"],
            "correct_answer": 1,
            "explanation": "d(uv) = u dv + v du. Integrating both sides yields ∫ u dv = uv - ∫ v du."
        },
        {
            "question": "In evaluating ∫ x * e^x dx using integration by parts, what is the best choice for u according to the ILATE rule?",
            "options": ["u = x", "u = e^x", "u = x * e^x", "u = 1"],
            "correct_answer": 0,
            "explanation": "Under ILATE (Algebraic before Exponential), choose u = x and dv = e^x dx. Then du = dx, v = e^x, giving x e^x - ∫ e^x dx = e^x (x - 1) + C."
        },
        {
            "question": "What is the result of ∫ ln(x) dx?",
            "options": ["x ln(x) - x + C", "1/x + C", "x ln(x) + x + C", "(ln x)² / 2 + C"],
            "correct_answer": 0,
            "explanation": "Set u = ln(x), dv = dx. Then du = 1/x dx, v = x. Formula gives x ln(x) - ∫ x * (1/x) dx = x ln(x) - x + C."
        }
    ],
    "differential equations": [
        {
            "question": "For the first-order linear differential equation dy/dx + P(x) y = Q(x), what is the integrating factor I(x)?",
            "options": ["e^(∫ P(x) dx)", "e^(∫ Q(x) dx)", "∫ P(x) dx", "ln(P(x))"],
            "correct_answer": 0,
            "explanation": "The integrating factor is I(x) = exp(∫ P(x) dx). Multiplying both sides by I(x) collapses the left side into d/dx [y * I(x)]."
        },
        {
            "question": "What is the order and degree of the differential equation (d²y/dx²)³ + (dy/dx)⁴ + y = 0?",
            "options": ["Order 2, Degree 3", "Order 3, Degree 2", "Order 4, Degree 2", "Order 2, Degree 4"],
            "correct_answer": 0,
            "explanation": "Order is highest derivative present (d²y/dx² -> order 2). Degree is highest power of highest derivative (power 3 -> degree 3)."
        }
    ],
    "cell cycle": [
        {
            "question": "During which phase of the cell cycle does DNA replication occur?",
            "options": ["G1 phase", "S (Synthesis) phase", "G2 phase", "M (Mitosis) phase"],
            "correct_answer": 1,
            "explanation": "During the S phase (Synthesis phase) of interphase, the cell replicates its chromosomal DNA accurately."
        },
        {
            "question": "At which mitotic stage do sister chromatids separate and move toward opposite poles?",
            "options": ["Prophase", "Metaphase", "Anaphase", "Telophase"],
            "correct_answer": 2,
            "explanation": "During anaphase, cohesin proteins are cleaved and sister chromatids are pulled apart to opposite centrosomes."
        },
        {
            "question": "Crossing over (homologous recombination) takes place during which sub-stage of Prophase I in meiosis?",
            "options": ["Leptotene", "Zygotene", "Pachytene", "Diplotene"],
            "correct_answer": 2,
            "explanation": "Synapsis completes in zygotene, and crossing over mediated by recombination nodules occurs strictly during pachytene."
        },
        {
            "question": "Which cyclin-dependent kinase (CDK) checkpoint oversees the transition from G1 to S phase?",
            "options": ["Restriction Checkpoint (R)", "Spindle Assembly Checkpoint", "G2/M DNA damage checkpoint", "Telophase Checkpoint"],
            "correct_answer": 0,
            "explanation": "The G1/S restriction point checks for DNA damage and adequate cell size before committing irreversibly to DNA replication."
        }
    ],
    "genetics": [
        {
            "question": "In a classic Mendelian monohybrid cross between two heterozygous parents (Bb x Bb), what is the expected phenotypic ratio for complete dominance?",
            "options": ["1:2:1", "3:1", "9:3:3:1", "1:1"],
            "correct_answer": 1,
            "explanation": "The genotypic ratio is 1 BB : 2 Bb : 1 bb, giving a phenotypic ratio of 3 dominant : 1 recessive."
        },
        {
            "question": "If two genes are located very close together on the same chromosome, they typically violate which Mendelian law?",
            "options": ["Law of Segregation", "Law of Independent Assortment", "Law of Dominance", "Hardy-Weinberg Principle"],
            "correct_answer": 1,
            "explanation": "Syntenic genes with physical linkage do not assort independently into gametes, thereby violating Mendel's Second Law."
        },
        {
            "question": "What is the phenotypic ratio in the F2 generation of a Mendelian dihybrid cross (AaBb x AaBb)?",
            "options": ["9:3:3:1", "1:2:1", "3:1", "12:3:1"],
            "correct_answer": 0,
            "explanation": "Independent assortment of two unlinked gene pairs with complete dominance produces the classic 9:3:3:1 phenotypic ratio."
        }
    ],
    "human physiology": [
        {
            "question": "In the human nephron, what is the primary mechanism of the countercurrent multiplier in the Loop of Henle?",
            "options": [
                "Establish a hyperosmolar medullary gradient via differential permeability of descending and ascending limbs",
                "Filtration of cellular elements by podocytes",
                "Secretion of renin by juxtaglomerular cells",
                "Hydrolysis of urea in collecting ducts"
            ],
            "correct_answer": 0,
            "explanation": "The descending limb is water-permeable, while the thick ascending limb actively pumps NaCl into the medullary interstitium, creating the osmotic gradient for water reabsorption."
        },
        {
            "question": "During cardiac ventricular depolarization, which wave is recorded on a standard ECG trace?",
            "options": ["P wave", "QRS complex", "T wave", "U wave"],
            "correct_answer": 1,
            "explanation": "The QRS complex corresponds to rapid ventricular depolarization, triggering ventricular systole."
        }
    ]
}


TOPIC_IMPORTANCE_DATABASE: Dict[str, Dict[str, Any]] = {
    "rotational motion": {
        "importance": "very_important",
        "weightage": "12-15% of Physics",
        "reason": "Guaranteed multi-concept questions on Moment of Inertia, Rolling without slipping, and Conservation of Angular Momentum.",
        "key_focus_areas": ["Moment of Inertia", "Torque & Angular Acceleration", "Rolling Motion & Work-Energy"]
    },
    "electrostatics": {
        "importance": "very_important",
        "weightage": "10-14% of Physics",
        "reason": "Crucial foundational topic for all electromagnetism; high frequency of Gauss Law & Potential calculations.",
        "key_focus_areas": ["Gauss Law & Flux", "Electric Potential & Field Relationships", "Capacitance & Dielectrics"]
    },
    "thermodynamics": {
        "importance": "very_important",
        "weightage": "10-12% of Physics",
        "reason": "High-yield scoring area with direct graphical (P-V) cyclic process and heat engine efficiency questions.",
        "key_focus_areas": ["First Law (ΔU = Q - W)", "Carnot Engine & Efficiency", "Adiabatic vs Isothermal Processes"]
    },
    "ray optics": {
        "importance": "important",
        "weightage": "7-9% of Physics",
        "reason": "Consistent formula-based lens-maker and total internal reflection ray diagrams.",
        "key_focus_areas": ["Total Internal Reflection", "Lens Maker's Equation", "Compound Optical Instruments"]
    },
    "reaction mechanisms": {
        "importance": "very_important",
        "weightage": "15-18% of Chemistry",
        "reason": "Backbone of organic synthesis: SN1/SN2, E1/E2 stereochemical outcomes appear in nearly every major exam.",
        "key_focus_areas": ["SN1 vs SN2 kinetics & stereochemistry", "Electrophilic Addition", "Nucleophilic Acyl Substitution"]
    },
    "stereochemistry": {
        "importance": "very_important",
        "weightage": "8-10% of Chemistry",
        "reason": "Chirality, R/S configuration, and optical activity are frequently tested as gatekeeper questions.",
        "key_focus_areas": ["Chirality & Enantiomers vs Diastereomers", "Meso compounds", "Fischer to Wedge-Dash projections"]
    },
    "named reactions": {
        "importance": "important",
        "weightage": "8-10% of Chemistry",
        "reason": "Direct conversion questions and multi-step synthesis pathways.",
        "key_focus_areas": ["Aldol Condensation", "Cannizzaro Reaction", "Grignard Syntheses"]
    },
    "limits and continuity": {
        "importance": "very_important",
        "weightage": "10-12% of Calculus",
        "reason": "Underpins all differential and integral calculus; indeterminate forms appear in almost every section.",
        "key_focus_areas": ["L'Hôpital's Rule & Standard Limits", "Continuity & Differentiability proofs", "Intermediate Value Theorem"]
    },
    "integration by parts": {
        "importance": "very_important",
        "weightage": "12-15% of Calculus",
        "reason": "Core technique in evaluation of product functions and reduction formulas in definite integrals.",
        "key_focus_areas": ["ILATE rule selection", "Reduction Formulas", "Definite integral evaluation"]
    },
    "differential equations": {
        "importance": "important",
        "weightage": "8-10% of Calculus",
        "reason": "Standard variable-separable and linear integrating factor problems.",
        "key_focus_areas": ["First-Order Linear ODEs & Integrating Factor", "Variable Separable Form", "Boundary Value Problems"]
    },
    "cell cycle": {
        "importance": "very_important",
        "weightage": "12-14% of Biology",
        "reason": "High frequency of questions on mitotic checkpoints, meiosis I crossover, and DNA replication phases.",
        "key_focus_areas": ["Meiosis I Prophase I substages", "S-Phase DNA duplication", "Cell cycle checkpoints & Cyclins"]
    },
    "genetics": {
        "importance": "very_important",
        "weightage": "15-20% of Biology",
        "reason": "Highest weightage biology topic; dihybrid crosses, pedigree charts, and linkage calculations.",
        "key_focus_areas": ["Mendelian Dihybrid ratios", "Pedigree Analysis", "Sex-linked inheritance & Recombination"]
    },
    "human physiology": {
        "importance": "important",
        "weightage": "10-12% of Biology",
        "reason": "Core conceptual questions on circulation, neuro-transmission, and nephron counter-current mechanisms.",
        "key_focus_areas": ["Nephron Counter-current multiplier", "Cardiac cycle & ECG", "Nerve impulse transmission"]
    }
}

def get_topic_importance(topic_name: str, subject_name: str = "") -> Dict[str, Any]:
    """Retrieve or deduce importance level (very_important / important / standard) for any topic."""
    normalized = topic_name.strip().lower()
    for key, data in TOPIC_IMPORTANCE_DATABASE.items():
        if key in normalized or normalized in key:
            return data

    # Heuristic importance deduction based on academic keywords
    high_yield_keywords = [
        "law", "mechanism", "calculus", "equation", "dynamics", "cycle", "genetic",
        "synthesis", "equilibrium", "conservation", "force", "wave", "quantum", "circuits"
    ]
    is_high_yield = any(kw in normalized for kw in high_yield_keywords)
    if is_high_yield:
        return {
            "importance": "very_important",
            "weightage": f"10-14% of {subject_name or 'Exam'}",
            "reason": f"Core theoretical and problem-solving cornerstone for {topic_name}. High likelihood of direct multi-part questions.",
            "key_focus_areas": [f"{topic_name} primary equations", f"Boundary applications of {topic_name}", "Complex derivations"]
        }
    return {
        "importance": "important",
        "weightage": f"6-9% of {subject_name or 'Exam'}",
        "reason": f"Essential syllabus component for {topic_name}. Tests conceptual understanding and standard applications.",
        "key_focus_areas": [f"Basic definitions of {topic_name}", "Standard formulas", "Direct problem solving"]
    }

def generate_heuristic_question(
    topic_name: str,
    subject_name: str = "",
    question_index: int = 0,
    total_requested: int = 5,
    used_questions: Optional[set] = None,
    difficulty: str = "moderate"
) -> Dict[str, Any]:
    """
    Generates a high-quality, academically rigorous contextual mock question for any topic.
    Extracts maximum questions by supporting 21 distinct question archetypes with non-repeating content:
    - Fundamental Axiom & Definition
    - SI Unit & Dimensional Analysis
    - Governing Mathematical Equation
    - Proportionality & Scaling Analysis
    - Graphical Interpretation (Slope & Area)
    - Asymptotic Limiting Behavior (x -> 0 & x -> inf)
    - Assertion & Reason
    - Incorrect Statement Trap
    - Experimental Technique & Laboratory Diagnostic
    - Engineering & Technological Application
    - Equilibrium & Stability Condition
    - Microscopic / Molecular Mechanism
    - Conservation Law & Work-Energy Relation
    - Time Rate of Change & Kinetic Progression
    - Uncertainty & Error Propagation
    - Comparative Analogous Systems
    - Threshold & Activation Criteria
    - Tensorial / Directional Classification
    - Modeling Assumptions & Ideal Conditions
    - Dynamic Damping & Dissipation
    - Optimization for Peak Performance
    """
    if used_questions is None:
        used_questions = set()

    normalized = topic_name.strip().lower()

    # 1. First attempt to pull unused curated questions from MOCK_QUESTION_BANK
    for key, q_list in MOCK_QUESTION_BANK.items():
        if key in normalized or normalized in key:
            available = [q for q in q_list if q["question"] not in used_questions]
            if available:
                q = available[question_index % len(available)]
                used_questions.add(q["question"])
                return {
                    "id": "q_" + secrets.token_hex(4),
                    "topic": topic_name,
                    "subject": subject_name,
                    "question": q["question"],
                    "options": q["options"],
                    "correct_answer": q["correct_answer"],
                    "explanation": q["explanation"],
                    "difficulty": "medium"
                }

    # 2. Rich Procedural Generator with 21 Archetypes
    archetypes = [
        # Archetype 0: Core Theoretical Axiom
        {
            "q": f"Which fundamental physical law or mathematical axiom forms the theoretical foundation of '{topic_name}' in {subject_name or 'the syllabus'}?",
            "opts": [
                f"Fundamental conservation and dynamic equilibrium governing {topic_name}",
                f"Static independence without boundary constraints in {topic_name}",
                f"Pure empirical approximation with non-reproducible variables",
                f"Arbitrary convention defined only for isolated idealized systems"
            ],
            "ans": 0,
            "exp": f"In {subject_name or 'academic science'}, '{topic_name}' is anchored on fundamental conservation laws and boundary state conditions that describe physical continuity and deterministic state transitions."
        },
        # Archetype 1: SI Unit & Dimensional Analysis
        {
            "q": f"In dimensional analysis and SI metrology, what is the principal dimensional formula characterizing the core rate or potential associated with '{topic_name}'?",
            "opts": [
                "[M L² T⁻²] (Energy / Work equivalent dimensions)",
                "[M L T⁻¹] (Linear momentum equivalent dimensions)",
                "[M L² T⁻³] (Power equivalent dimensions)",
                "[M⁰ L⁰ T⁰] (Strictly dimensionless ratio)"
            ],
            "ans": 0,
            "exp": f"The primary energetic and potential formulations in '{topic_name}' dimensionally reduce to work and energy units [M L² T⁻²] (Joules in SI), consistent with energy conservation."
        },
        # Archetype 2: Governing Mathematical Equation
        {
            "q": f"Which mathematical formulation correctly describes the primary governing rate or state relation for '{topic_name}'?",
            "opts": [
                f"First-order differential flux relationship: dΨ/dt = -k · ∇²Ψ or equivalent rate balance in {topic_name}",
                f"Arbitrary cubic divergence: Ψ³ = 0 independent of system boundary",
                f"Discontinuous step function with non-integrable singular poles",
                f"Pure scalar static constant invariant to external driving potentials"
            ],
            "ans": 0,
            "exp": f"Standard analytical treatments of '{topic_name}' formulate governing equations as differential balances equating time rates of change to spatial flux gradients or restoring potentials."
        },
        # Archetype 3: Proportionality & Scaling Analysis
        {
            "q": f"If the characteristic primary variable in '{topic_name}' is doubled (scaled by a factor of 2) under linear conditions, how does the resulting second-order energy response scale?",
            "opts": [
                "Increases by a factor of 4 (quadratic scaling, 2² = 4)",
                "Remains strictly unchanged (zero sensitivity)",
                "Decreases by a factor of 2 (inversely proportional)",
                "Increases by a factor of 8 (cubic scaling)"
            ],
            "ans": 0,
            "exp": f"In '{topic_name}', energy and power responses depend quadratically on fundamental field and amplitude variables (E ∝ x²), meaning a 2x increase yields a 4x response."
        },
        # Archetype 4: Graphical Slope Meaning
        {
            "q": f"In a standard characteristic plot representing '{topic_name}' (Output vs Input variable), what does the instantaneous slope (derivative dy/dx) physically represent?",
            "opts": [
                f"The dynamic susceptibility, rate constant, or effective stiffness of {topic_name}",
                f"The total cumulative energy dissipation across the full timeline",
                f"The geometric center of gravity of the test specimen",
                f"An unphysical numerical artifact with zero diagnostic value"
            ],
            "ans": 0,
            "exp": f"The derivative dy/dx on a characteristic curve of '{topic_name}' represents the system's differential sensitivity, conductance, or rate response at that operating point."
        },
        # Archetype 5: Area Under the Curve (Definite Integral)
        {
            "q": f"When examining the response curve of '{topic_name}', what physical quantity is evaluated by taking the definite integral (area under the curve)?",
            "opts": [
                f"The cumulative work done, total flux, or accumulated state change in {topic_name}",
                f"The instantaneous acceleration at the terminal boundary point",
                f"The ratio of ambient temperature to atmospheric pressure",
                f"The spatial variance of ambient electromagnetic noise"
            ],
            "ans": 0,
            "exp": f"Integrating the governing rate or force curve across displacement or time yields the total accumulated work done or cumulative state transfer in '{topic_name}'."
        },
        # Archetype 6: Asymptotic Limit as x -> 0
        {
            "q": f"As the driving scale parameter in '{topic_name}' approaches zero (limiting low-intensity case), what asymptotic behavior is typically observed?",
            "opts": [
                f"Linear perturbation behavior where higher-order nonlinear terms become negligible",
                f"Sudden infinite catastrophic divergence of all state variables",
                f"Complete violation of the Second Law of Thermodynamics",
                f"Oscillatory chaos with non-convergent Lyapunov exponents"
            ],
            "ans": 0,
            "exp": f"At infinitesimal scales, systems governed by '{topic_name}' reduce to linear first-order approximations, as higher-order Taylor series terms vanish as x → 0."
        },
        # Archetype 7: Asymptotic Limit as x -> Infinity
        {
            "q": f"Under extreme conditions where the excitation variable in '{topic_name}' becomes very large (x → ∞), what constraint prevents unphysical runaway?",
            "opts": [
                f"Saturation limits, thermodynamic depletion, or structural boundary capacity",
                f"Instantaneous reversal of the arrow of time",
                f"Spontaneous generation of negative inertial mass",
                f"Absolute zero temperature attainment at room ambient"
            ],
            "ans": 0,
            "exp": f"Real physical systems in '{topic_name}' exhibit saturation or damping caps that prevent infinite divergence as input excitations grow arbitrarily large."
        },
        # Archetype 8: Assertion & Reason
        {
            "q": f"Given the following statements regarding '{topic_name}':\nAssertion (A): Isolated systems governed by {topic_name} strictly preserve total energy.\nReason (R): Conservative restoring forces derive from continuous potential gradients (F = -∇U).\nWhich is correct?",
            "opts": [
                "Both (A) and (R) are true, and (R) is the correct explanation of (A)",
                "Both (A) and (R) are true, but (R) is NOT the correct explanation of (A)",
                "(A) is true, but (R) is false",
                "(A) is false, but (R) is true"
            ],
            "ans": 0,
            "exp": f"In '{topic_name}', conservation of energy is directly underpinned by the existence of conservative potential fields whose work is path-independent."
        },
        # Archetype 9: False / Incorrect Statement Trap
        {
            "q": f"Which of the following statements regarding '{topic_name}' is scientifically INCORRECT?",
            "opts": [
                f"'{topic_name}' can spontaneously generate net positive mechanical work in a closed cycle without any external energy input",
                f"'{topic_name}' obeys standard continuity and conservation principles",
                f"Changes in system boundary conditions directly shift the steady-state equilibrium of '{topic_name}'",
                f"Empirical measurements of '{topic_name}' are subject to standard statistical error propagation"
            ],
            "ans": 0,
            "exp": f"Perpetual motion of the first kind is physically impossible: '{topic_name}' cannot generate net mechanical work without energy consumption, making option A strictly false."
        },
        # Archetype 10: Diagnostic & Experimental Methodology
        {
            "q": f"When conducting laboratory experiments to rigorously verify the phenomena in '{topic_name}', what represents the critical control protocol?",
            "opts": [
                f"Isolating the primary independent variable while holding temperature and boundary factors strictly constant",
                f"Varying all environmental parameters simultaneously without baseline calibration",
                f"Assuming zero measurement noise and omitting repeat validation trials",
                f"Discarding outlier data points without statistical Dixon or Chauvenet tests"
            ],
            "ans": 0,
            "exp": f"Valid empirical investigation of '{topic_name}' demands strict isolation of control variables so that observed responses can be uniquely attributed to the tested parameter."
        },
        # Archetype 11: Real-World Engineering Application
        {
            "q": f"How is the core scientific mechanism of '{topic_name}' predominantly utilized in modern technological and engineering applications?",
            "opts": [
                f"In calibrating sensor feedback, optimizing conversion efficiency, and stabilizing dynamic throughput",
                f"Exclusively in decorative non-functional consumer coatings",
                f"As a theoretical curiosity with zero practical engineering viability",
                f"Solely in producing irreversible frictional heat losses without useful output"
            ],
            "ans": 0,
            "exp": f"Principles of '{topic_name}' are foundational in sensor instrumentation, control loops, and high-efficiency energy conversion systems worldwide."
        },
        # Archetype 12: Stability and Equilibrium Condition
        {
            "q": f"What mathematical condition characterizes stable equilibrium for a system governed by '{topic_name}'?",
            "opts": [
                f"Potential energy U is at a local minimum (dU/dx = 0 and d²U/dx² > 0)",
                f"Potential energy U is at a local maximum (d²U/dx² < 0)",
                f"Total net force is maximized and directed away from the origin",
                f"The system exhibits negative kinetic energy"
            ],
            "ans": 0,
            "exp": f"Stable equilibrium in '{topic_name}' requires the first derivative of potential energy to vanish (zero net force) and the second derivative to be strictly positive (restoring force)."
        },
        # Archetype 13: Microscopic Mechanism
        {
            "q": f"At the microscopic or molecular level, what fundamental mechanism drives observable bulk phenomena in '{topic_name}'?",
            "opts": [
                f"Statistical collective collisions, intermolecular force potentials, and energy equipartition",
                f"Static immobility of constituent particles with zero thermal motion",
                f"Violation of charge neutrality at all macroscopic distances",
                f"Random telepathic coupling between non-interacting nuclei"
            ],
            "ans": 0,
            "exp": f"Macroscopic properties in '{topic_name}' emerge directly from statistical mechanics: particle velocity distributions and intermolecular potential interactions."
        },
        # Archetype 14: Rate Law & Kinetic Progression
        {
            "q": f"How does an increase in operating temperature typically affect the characteristic response rate in '{topic_name}'?",
            "opts": [
                f"Accelerates the rate in accordance with Arrhenius exponential kinetics (k ∝ e^(-Ea / RT))",
                f"Immediately freezes all dynamic activity to absolute zero rate",
                f"Has zero thermodynamic influence across any temperature range",
                f"Causes an instantaneous linear drop to negative rates"
            ],
            "ans": 0,
            "exp": f"Thermal kinetic theory dictates that increased temperature increases the fraction of constituent states exceeding the activation barrier, exponentially accelerating the rate in '{topic_name}'."
        },
        # Archetype 15: Error Analysis & Fractional Uncertainty
        {
            "q": f"If an experimentalist incurs an uncertainty of ±2% in measuring the primary base variable x in '{topic_name}', what is the resulting uncertainty in a quantity that scales as x³?",
            "opts": [
                "±6% (since fractional error in x^n is n · Δx/x = 3 · 2% = 6%)",
                "±2% (uncertainty remains unchanged)",
                "±8% (2³ = 8%)",
                "±0.67% (2% / 3)"
            ],
            "ans": 0,
            "exp": f"Standard propagation of error rules establish that for y = x^n, Δy/y = |n| · (Δx/x). For n = 3 and 2% uncertainty, 3 · 2% = 6%."
        },
        # Archetype 16: Comparative Analogous Systems
        {
            "q": f"When comparing '{topic_name}' to analogous linear or mechanical systems, which dual relationship is mathematically equivalent?",
            "opts": [
                f"Flux corresponds to current, driving potential corresponds to voltage, and resistance opposes flow",
                f"Potential energy is completely substituted by random entropy generation",
                f"Mass is replaced by zero-dimensional mathematical points",
                f"Restoring forces act exclusively in the direction of increasing perturbation"
            ],
            "ans": 0,
            "exp": f"The lumped-parameter analogy applies directly to '{topic_name}': effort variables (voltage/pressure/force) drive flow variables (current/volume rate/velocity) against impedance."
        },
        # Archetype 17: Threshold / Critical Value
        {
            "q": f"What physical consequence occurs when a system governed by '{topic_name}' crosses its critical threshold or resonance frequency?",
            "opts": [
                f"A qualitative bifurcation or dramatic surge in amplitude occurs due to constructive phase alignment",
                f"The system spontaneously converts all mass into electromagnetic radiation",
                f"All degrees of freedom instantaneously collapse to a single point",
                f"The governing equations lose mathematical continuity indefinitely"
            ],
            "ans": 0,
            "exp": f"Crossing a critical threshold in '{topic_name}' precipitates state bifurcations or resonant response peaks where driving forces align in-phase with natural frequencies."
        },
        # Archetype 18: Tensorial and Vector Properties
        {
            "q": f"Which statement accurately classifies the directional and geometric character of the quantities in '{topic_name}'?",
            "opts": [
                f"Scalar quantities (magnitude only) govern energetic states, while vector/tensor quantities dictate directional transport",
                f"All metrics in '{topic_name}' are strictly four-dimensional quaternions",
                f"Directional orientation has zero influence on the trajectory of '{topic_name}'",
                f"Tensorial shear stresses cannot exist under any stress tensor configuration"
            ],
            "ans": 0,
            "exp": f"Analytical models of '{topic_name}' decompose energy into frame-independent scalars while fluxes, forces, and gradients require vector and tensor formulations."
        },
        # Archetype 19: Damping and Transient Relaxation
        {
            "q": f"In a dynamic system governed by '{topic_name}', what determines the time required for transient oscillations to settle into steady state?",
            "opts": [
                f"The damping ratio ζ and system natural frequency ωn (relaxation time τ ≈ 1 / (ζ · ωn))",
                f"The geographical altitude of the test laboratory exclusively",
                f"The color of the physical casing housing the experiment",
                f"An indeterminate random variable that changes on every observation"
            ],
            "ans": 0,
            "exp": f"Transient relaxation in '{topic_name}' is governed by exponential decay e^(-ζ ωn t), where the time constant τ = 1/(ζ ωn) dictates the settlement period."
        },
        # Archetype 20: Optimization for Peak Performance
        {
            "q": f"What condition mathematically characterizes the point of maximum efficiency or throughput in '{topic_name}'?",
            "opts": [
                f"The first derivative of the performance function equals zero (dη/dx = 0) with a negative second derivative (d²η/dx² < 0)",
                f"Operating at minimum possible resistance with zero output load",
                f"Setting the internal impedance to infinity",
                f"Operating exclusively in the unstable divergent regime"
            ],
            "ans": 0,
            "exp": f"Optimization in '{topic_name}' utilizes standard extrema calculus: setting dη/dx = 0 locates the stationary point, and d²η/dx² < 0 confirms a true local maximum."
        }
    ]

    total_archetypes = len(archetypes)
    diff_norm = difficulty.lower().strip() if difficulty else "moderate"
    if diff_norm == "easy":
        pool = [0, 1, 2, 8, 9, 11, 12, 17]
    elif diff_norm == "difficult":
        pool = [3, 4, 5, 6, 7, 10, 14, 15, 16, 18, 19, 20]
    else:
        diff_norm = "moderate"
        pool = list(range(total_archetypes))

    pool_len = len(pool)
    base_pool_idx = (question_index + abs(hash(topic_name))) % pool_len
    selected = archetypes[pool[base_pool_idx]]
    q_text = selected["q"]
    counter = 1
    while q_text in used_questions and counter < pool_len:
        next_idx = (base_pool_idx + counter) % pool_len
        selected = archetypes[pool[next_idx]]
        q_text = selected["q"]
        counter += 1

    if q_text in used_questions:
        q_text = f"[Deep Drill #{question_index + 1}] {q_text}"

    used_questions.add(q_text)

    # Randomize option order so correct answer is distributed across A, B, C, D (0, 1, 2, 3)
    opts = list(selected["opts"])
    correct_text = opts[selected["ans"]]
    random.shuffle(opts)
    new_ans = opts.index(correct_text)

    return {
        "id": "q_" + secrets.token_hex(4),
        "topic": topic_name,
        "subject": subject_name,
        "question": q_text,
        "options": opts,
        "correct_answer": new_ans,
        "explanation": selected["exp"],
        "difficulty": diff_norm
    }

# -------------------------------------------------------------
# Schedule Planning Service
# -------------------------------------------------------------

async def plan_schedule_with_ai(
    syllabus: List[Dict[str, Any]],
    exam_name: str,
    exam_date: str,
    sitting_capacity_mins: int = 45,
    daily_goal_mins: int = 180,
    yesterday_topics: Optional[List[Dict[str, Any]]] = None,
    current_tasks: Optional[List[Dict[str, Any]]] = None,
    api_key: Optional[str] = None
) -> Dict[str, Any]:
    """
    Intelligently generates a study schedule based on:
    - Days until the exam
    - The student's maximum sitting capacity (e.g. 45 min slots)
    - Topics covered yesterday (triggers recall mock tests next day!)
    - Spaced repetition stages for each topic
    """
    today_dt = datetime.now()
    today_str = today_dt.strftime("%Y-%m-%d")
    
    try:
        exam_dt = datetime.strptime(exam_date, "%Y-%m-%d")
    except Exception:
        exam_dt = today_dt + timedelta(days=21)
        exam_date = exam_dt.strftime("%Y-%m-%d")
        
    days_to_exam = max(1, (exam_dt - today_dt).days)
    
    # Sitting capacity constraint
    sitting_capacity_mins = max(20, min(120, sitting_capacity_mins or 45))
    daily_goal_mins = max(60, min(480, daily_goal_mins or 180))
    
    # Number of chunks per day based on sitting capacity
    sessions_per_day = max(1, round(daily_goal_mins / sitting_capacity_mins))
    
    # Extract all topics
    all_topics = []
    for s in syllabus:
        s_id = s.get("id", "gen")
        s_name = s.get("name", "General")
        for tp in s.get("topics", []):
            all_topics.append({
                "subjectId": s_id,
                "subjectName": s_name,
                "topicId": tp.get("id"),
                "name": tp.get("name"),
                "stage": tp.get("stage", 0),
                "next": tp.get("next", today_str)
            })

    # Try LLM generation if API Key available
    llm_prompt = f"""
You are an expert AI Study Scheduling Agent for StudyPilot.
Target Exam: {exam_name}
Target Exam Date: {exam_date} ({days_to_exam} days remaining from today {today_str})
Student's Maximum Sitting Capacity per session: {sitting_capacity_mins} minutes
Daily Study Target: {daily_goal_mins} minutes ({sessions_per_day} study sessions/day)
Topics Covered Yesterday: {json.dumps([t.get('name') for t in (yesterday_topics or [])])}

Syllabus Subjects & Topics:
{json.dumps([{ 'subject': s.get('name'), 'topics': [t.get('name') for t in s.get('topics', [])] } for s in syllabus], indent=2)}

Rules:
1. Divide daily study into bite-sized tasks matching the student's maximum sitting capacity of {sitting_capacity_mins} minutes each.
2. CRITICAL: If topics were covered yesterday, the VERY FIRST task scheduled for TODAY must be a "{sitting_capacity_mins}-min Mock Test Paper / Recall Drill on Yesterday's Topics".
3. Distribute topics evenly across the {days_to_exam} days up to {exam_date}.
4. Prioritize weaker/earlier stage topics first, then spaced review, and full mock papers 2-3 days before the exam.
5. Return ONLY a valid JSON object with:
   - "summary": string explaining the pacing rationale based on sitting capacity and days to exam
   - "daily_routine": string giving clear session advice (e.g., 45m focus + 10m break)
   - "tasks": array of task objects with fields:
       "title": string descriptive title
       "subjectId": string matching one of the subject IDs
       "date": "YYYY-MM-DD"
       "mins": {sitting_capacity_mins}
       "prio": "high" | "med" | "low"
       "done": false
       "is_mock_test": boolean (true if recall or mock test)
"""
    raw_llm = await call_llm(llm_prompt, api_key, system_instruction="You are a professional educational AI planner. Always reply in valid JSON format.", json_mode=True)
    
    if raw_llm:
        try:
            parsed = json.loads(raw_llm)
            if "tasks" in parsed and isinstance(parsed["tasks"], list) and len(parsed["tasks"]) > 0:
                # Add unique IDs
                for t in parsed["tasks"]:
                    t["id"] = "sp_" + secrets.token_hex(4)
                return {
                    "source": "live_ai",
                    "summary": parsed.get("summary", f"AI-optimized study roadmap tailored to your {sitting_capacity_mins}-minute focus capacity and {days_to_exam} days until {exam_name}."),
                    "daily_routine": parsed.get("daily_routine", f"{sessions_per_day} sessions of {sitting_capacity_mins} mins with 5-10 min intervals."),
                    "sitting_capacity_mins": sitting_capacity_mins,
                    "days_to_exam": days_to_exam,
                    "tasks": parsed["tasks"]
                }
        except Exception:
            pass

    # High-Fidelity Algorithmic Generator
    generated_tasks = []
    
    # Day 0 = Today
    # Rule: If topics were covered yesterday, schedule recall mock test FIRST for today!
    if yesterday_topics and len(yesterday_topics) > 0:
        y_names = ", ".join([t.get("name", "Previous topic") for t in yesterday_topics[:2]])
        y_subj = yesterday_topics[0].get("subjectId") or (syllabus[0]["id"] if syllabus else "phy")
        generated_tasks.append({
            "id": "sp_" + secrets.token_hex(4),
            "title": f"Yesterday's Recall Mock Test: {y_names}",
            "subjectId": y_subj,
            "date": today_str,
            "mins": min(sitting_capacity_mins, 45),
            "prio": "high",
            "done": False,
            "is_mock_test": True
        })

    # Sort topics by stage (stage 0 first, then overdue)
    sorted_topics = sorted(all_topics, key=lambda x: (x["stage"], x["next"]))
    
    plan_days = min(days_to_exam, 14) # plan upcoming 1-2 weeks in detail
    topic_cursor = 0
    num_topics = max(1, len(sorted_topics))

    for day_offset in range(plan_days):
        day_date = (today_dt + timedelta(days=day_offset)).strftime("%Y-%m-%d")
        
        # Determine tasks for this day
        existing_today = len([t for t in generated_tasks if t["date"] == day_date])
        slots_needed = max(1, sessions_per_day - existing_today)
        
        # If last 2 days before exam, schedule full mock test!
        if (days_to_exam - day_offset) <= 2:
            s_rand = syllabus[day_offset % len(syllabus)] if syllabus else {"id": "phy", "name": "Physics"}
            generated_tasks.append({
                "id": "sp_" + secrets.token_hex(4),
                "title": f"Full-length Exam Simulator: {exam_name} Mock Paper",
                "subjectId": s_rand["id"],
                "date": day_date,
                "mins": sitting_capacity_mins,
                "prio": "high",
                "done": False,
                "is_mock_test": True
            })
            continue

        for slot in range(slots_needed):
            curr_tp = sorted_topics[topic_cursor % num_topics]
            topic_cursor += 1
            
            # Action type based on stage
            if curr_tp["stage"] == 0:
                action_title = f"Deep dive & notes: {curr_tp['name']}"
                prio = "high"
            elif curr_tp["stage"] in (1, 2):
                action_title = f"Problem drills & revision: {curr_tp['name']}"
                prio = "med"
            else:
                action_title = f"Timed practice questions: {curr_tp['name']}"
                prio = "med"
                
            generated_tasks.append({
                "id": "sp_" + secrets.token_hex(4),
                "title": action_title,
                "subjectId": curr_tp["subjectId"],
                "date": day_date,
                "mins": sitting_capacity_mins,
                "prio": prio,
                "done": False,
                "is_mock_test": False
            })

    summary_msg = (
        f"Smart schedule constructed for {exam_name} ({days_to_exam} days remaining). "
        f"Daily workload divided into {sitting_capacity_mins}-minute focused blocks matching your maximum sitting capacity. "
        + (f"Includes automated 24h recall testing on yesterday's covered topics ({len(yesterday_topics)} topics)." if yesterday_topics else "")
    )

    return {
        "source": "heuristic_ai",
        "summary": summary_msg,
        "daily_routine": f"{sessions_per_day} blocks of {sitting_capacity_mins}m with 5m restorative intervals between sessions.",
        "sitting_capacity_mins": sitting_capacity_mins,
        "days_to_exam": days_to_exam,
        "tasks": generated_tasks
    }

# -------------------------------------------------------------
# Mock Test Generator Service & Topic Importance Extraction
# -------------------------------------------------------------

async def extract_topic_importance(
    syllabus: List[Dict[str, Any]],
    exam_name: str,
    exam_date: Optional[str] = None,
    api_key: Optional[str] = None
) -> Dict[str, Any]:
    """
    Analyzes syllabus topics and extracts:
    - Very Important Topics (🔥 High Yield, highest exam weightage)
    - Important Topics (⭐ Core syllabus)
    - Standard Topics
    """
    llm_prompt = f"""
You are an expert exam strategist and syllabus analyzer for {exam_name}.
Target Exam: {exam_name}
Target Exam Date: {exam_date or 'Upcoming'}

Analyze every subject and topic below. Extract and classify each topic as:
- 'very_important' (🔥 High yield, guaranteed multi-concept questions, 10%+ weightage)
- 'important' (⭐ Core syllabus, high probability, 6-9% weightage)
- 'standard' (Supplementary / foundational)

Syllabus:
{json.dumps([{ 'id': s.get('id'), 'subject': s.get('name'), 'topics': [t.get('name') for t in s.get('topics', [])] } for s in syllabus], indent=2)}

Format: Return a valid JSON object ONLY:
{{
  "summary": "Concise 2-3 sentence strategic executive summary of high-yield areas for this exam",
  "analyzed_subjects": [
    {{
      "subject_id": "phy",
      "subject_name": "Physics",
      "topics": [
        {{
          "topic_name": "Rotational motion",
          "importance": "very_important",
          "weightage": "12-15%",
          "reason": "Why this topic is critical for the exam",
          "key_focus_areas": ["Sub-concept 1", "Sub-concept 2"]
        }}
      ]
    }}
  ]
}}
"""
    raw_llm = await call_llm(llm_prompt, api_key, system_instruction="You are an expert academic curriculum analyst. Reply in valid JSON only.", json_mode=True)
    if raw_llm:
        try:
            parsed = json.loads(raw_llm)
            if "analyzed_subjects" in parsed and isinstance(parsed["analyzed_subjects"], list):
                very_imp = []
                imp = []
                std = []
                for s in parsed["analyzed_subjects"]:
                    s_name = s.get("subject_name", "")
                    s_id = s.get("subject_id", "")
                    for tp in s.get("topics", []):
                        item = {
                            "topicName": tp.get("topic_name", ""),
                            "subjectName": s_name,
                            "subjectId": s_id,
                            "importance": tp.get("importance", "important"),
                            "weightage": tp.get("weightage", "8-10%"),
                            "reason": tp.get("reason", ""),
                            "key_focus_areas": tp.get("key_focus_areas", [])
                        }
                        if item["importance"] == "very_important":
                            very_imp.append(item)
                        elif item["importance"] == "important":
                            imp.append(item)
                        else:
                            std.append(item)

                return {
                    "source": "live_ai",
                    "summary": parsed.get("summary", f"AI High-Yield Analysis for {exam_name}"),
                    "very_important_topics": very_imp,
                    "important_topics": imp,
                    "standard_topics": std,
                    "analyzed_subjects": parsed["analyzed_subjects"]
                }
        except Exception:
            pass

    # Heuristic academic analysis
    very_imp = []
    imp = []
    std = []
    analyzed_subjects = []

    for s in syllabus:
        s_id = s.get("id", "gen")
        s_name = s.get("name", "General")
        s_topics_analyzed = []

        for tp in s.get("topics", []):
            tp_name = tp.get("name", "Topic")
            imp_data = get_topic_importance(tp_name, s_name)
            entry = {
                "topicName": tp_name,
                "topicId": tp.get("id"),
                "subjectName": s_name,
                "subjectId": s_id,
                "importance": imp_data["importance"],
                "weightage": imp_data["weightage"],
                "reason": imp_data["reason"],
                "key_focus_areas": imp_data.get("key_focus_areas", [])
            }
            s_topics_analyzed.append(entry)

            if imp_data["importance"] == "very_important":
                very_imp.append(entry)
            elif imp_data["importance"] == "important":
                imp.append(entry)
            else:
                std.append(entry)

        analyzed_subjects.append({
            "subject_id": s_id,
            "subject_name": s_name,
            "topics": s_topics_analyzed
        })

    summary_text = (
        f"High-Yield Analysis for {exam_name}: Extracted {len(very_imp)} Very Important topics (commanding ~50-60% of total exam weightage) "
        f"and {len(imp)} Core Important topics. Focus on mastery of these critical topics first to maximize exam score."
    )

    return {
        "source": "heuristic_ai",
        "summary": summary_text,
        "very_important_topics": very_imp,
        "important_topics": imp,
        "standard_topics": std,
        "analyzed_subjects": analyzed_subjects
    }

async def generate_mock_test(
    topics: List[Dict[str, str]],
    subject_name: Optional[str] = "Syllabus",
    num_questions: int = 5,
    difficulty: str = "medium",
    importance_filter: Optional[str] = None,
    extract_maximum: bool = False,
    api_key: Optional[str] = None
) -> Dict[str, Any]:
    """
    Generates an academic mock test paper for given topics.
    Supports maximum questions extraction (up to 100 questions) for exhaustive syllabus drilling.
    """
    if extract_maximum and num_questions <= 5:
        num_questions = 50

    num_questions = max(3, min(100, num_questions))
    
    def _extract_topic_name(t):
        if isinstance(t, dict):
            return t.get("name") or t.get("title") or "Core Topic"
        return str(t)

    # If importance_filter is specified, filter topics
    if importance_filter == "very_important":
        filtered_topics = [t for t in topics if get_topic_importance(_extract_topic_name(t))["importance"] == "very_important"]
        if filtered_topics:
            topics = filtered_topics

    topic_names = [_extract_topic_name(t) for t in topics]
    topics_str = ", ".join(topic_names) if topic_names else "General Syllabus"

    time_limit_mins = max(5, min(180, int(num_questions * 1.5)))

    llm_prompt = f"""
Generate an academic mock test paper for students preparing for examinations.
Subject: {subject_name}
Topics: {topics_str}
Number of Questions: {num_questions}
Difficulty Level: {difficulty}
Focus: Exhaustive High-Yield Question Bank & Rigorous Exam Preparation

CRITICAL REQUIREMENT:
Generate exactly {num_questions} completely unique, non-repeating academic questions spanning all sub-concepts:
- Fundamental definitions and theorems
- Key equations, formulas, and dimensional formulas
- Numerical problem solving and scaling relations
- Graphical interpretations (slopes, areas, trends)
- Common exam traps, misconceptions, and exceptions
- Assertion-Reason & statement verification questions

Format: Return a valid JSON object ONLY:
{{
  "title": "{subject_name}: {topics_str[:40]} Mock Test ({num_questions} Questions)",
  "time_limit_mins": {time_limit_mins},
  "questions": [
    {{
      "id": "q1",
      "topic": "Topic Name",
      "question": "Clear, precise academic multiple-choice question",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_answer": 0,
      "explanation": "Clear explanation of why option A is correct and why other options fail.",
      "importance": "very_important"
    }}
  ]
}}
Ensure exactly 4 options per question, correct_answer is an integer (0, 1, 2, or 3), and explanations are thorough.
"""

    raw_llm = await call_llm(llm_prompt, api_key, system_instruction="You are a master test paper examiner. Always reply with valid JSON only.", json_mode=True)
    if raw_llm:
        try:
            parsed = json.loads(raw_llm)
            if "questions" in parsed and len(parsed["questions"]) > 0:
                returned_qs = parsed["questions"]
                for i, q in enumerate(returned_qs):
                    if "id" not in q:
                        q["id"] = f"q_{i+1}_{secrets.token_hex(2)}"
                    t_name = q.get("topic", "")
                    imp_data = get_topic_importance(t_name, subject_name or "")
                    q["importance"] = q.get("importance") or imp_data["importance"]
                    q["weightage"] = imp_data.get("weightage", "")

                # If LLM returned fewer questions than requested, supplement with procedural questions!
                if len(returned_qs) < num_questions:
                    used_q_texts = {q.get("question", "") for q in returned_qs}
                    needed = num_questions - len(returned_qs)
                    for k in range(needed):
                        idx = len(returned_qs)
                        t_name = topic_names[idx % len(topic_names)] if topic_names else "Core Syllabus"
                        supp_q = generate_heuristic_question(
                            t_name,
                            subject_name or "General",
                            question_index=idx,
                            total_requested=num_questions,
                            used_questions=used_q_texts
                        )
                        imp_data = get_topic_importance(t_name, subject_name or "")
                        supp_q["importance"] = imp_data["importance"]
                        supp_q["weightage"] = imp_data.get("weightage", "")
                        returned_qs.append(supp_q)

                return {
                    "source": "live_ai",
                    "test_id": "test_" + secrets.token_hex(6),
                    "title": parsed.get("title", f"{subject_name} ({len(returned_qs)} Questions)"),
                    "subject": subject_name,
                    "topics": topic_names,
                    "time_limit_mins": parsed.get("time_limit_mins", time_limit_mins),
                    "questions": returned_qs[:num_questions],
                    "created_at": datetime.now().isoformat()
                }
        except Exception:
            pass

    # High-Yield Heuristic Procedural Test Generation
    used_questions = set()
    questions = []
    for i in range(num_questions):
        t_name = topic_names[i % len(topic_names)] if topic_names else "Core Syllabus"
        q = generate_heuristic_question(
            t_name,
            subject_name or "General",
            question_index=i,
            total_requested=num_questions,
            used_questions=used_questions
        )
        q["id"] = f"q_{i+1}_{secrets.token_hex(3)}"
        imp_data = get_topic_importance(t_name, subject_name or "")
        q["importance"] = imp_data["importance"]
        q["weightage"] = imp_data.get("weightage", "")
        questions.append(q)

    is_high_yield_test = any(get_topic_importance(t)["importance"] == "very_important" for t in topic_names)
    if num_questions >= 25:
        test_title = f"⚡ Exhaustive Question Bank: {topics_str[:40]} ({len(questions)} Questions)"
    elif is_high_yield_test:
        test_title = f"🔥 High-Yield Mock Test: {topics_str[:40]} ({len(questions)} Questions)"
    else:
        test_title = f"Mock Test: {topics_str[:40]} ({len(questions)} Questions)"

    return {
        "source": "heuristic_ai",
        "test_id": "test_" + secrets.token_hex(6),
        "title": test_title,
        "subject": subject_name,
        "topics": topic_names,
        "time_limit_mins": time_limit_mins,
        "questions": questions,
        "created_at": datetime.now().isoformat()
    }

# -------------------------------------------------------------
# AI Agent Chat Service (Sitting Capacity & Study Guidance)
# -------------------------------------------------------------

async def chat_with_study_agent(
    user_message: str,
    conversation_history: List[Dict[str, str]],
    syllabus: List[Dict[str, Any]],
    exam_name: str,
    exam_date: str,
    yesterday_topics: Optional[List[Dict[str, Any]]] = None,
    current_sitting_capacity: int = 45,
    api_key: Optional[str] = None
) -> Dict[str, Any]:
    """
    Interactive conversation with StudyPilot's AI Agent.
    - Proactively asks questions about sitting capacity
    - Advises how to plan before exams
    - Triggers mock tests and dynamic schedule recalculation
    """
    today_dt = datetime.now()
    days_to_exam = 21
    try:
        days_to_exam = (datetime.strptime(exam_date, "%Y-%m-%d") - today_dt).days
    except Exception:
        pass

    # Check if user mentioned sitting capacity in their message (e.g., "45 minutes", "1 hour", "30 mins")
    detected_capacity = None
    msg_lower = user_message.lower()
    for span in [30, 45, 60, 90, 120, 25, 50, 40]:
        if f"{span} min" in msg_lower or f"{span}m" in msg_lower:
            detected_capacity = span
            break
    if not detected_capacity:
        if "1 hour" in msg_lower or "one hour" in msg_lower:
            detected_capacity = 60
        elif "2 hour" in msg_lower:
            detected_capacity = 90
        elif "half hour" in msg_lower:
            detected_capacity = 30

    system_instruction = f"""
You are StudyPilot AI, an elite personal tutor and study coach.
Current Context:
- Target Exam: {exam_name}
- Target Date: {exam_date} ({days_to_exam} days remaining)
- User's Known Maximum Sitting Capacity: {detected_capacity or current_sitting_capacity} mins
- Yesterday's Covered Topics: {json.dumps([t.get('name') for t in (yesterday_topics or [])])}
- Syllabus Subjects: {', '.join([s.get('name', '') for s in syllabus])}

Your Role:
1. If the user hasn't specified their maximum sitting capacity or asks for study planning, warmly ask them:
   "To calibrate your schedule perfectly, what is your maximum sitting capacity for study in one stretch? (e.g., 30 mins, 45 mins, 60 mins, or 90 mins? And how many hours total can you spend per day?)"
2. If topics were covered yesterday, celebrate their consistency and recommend taking the 5-minute Recall Mock Test today to solidify long-term memory.
3. Keep responses inspiring, concise, structured with bullet points, and directly actionable.
4. If the user accepts or shares their capacity, recommend generating a fresh schedule aligned to their exam timing.
"""

    formatted_history = ""
    for msg in conversation_history[-6:]:
        role = "Student" if msg.get("role") == "user" else "StudyPilot AI"
        formatted_history += f"{role}: {msg.get('content')}\n"

    prompt = f"{formatted_history}\nStudent: {user_message}\nStudyPilot AI:"

    raw_reply = await call_llm(prompt, api_key, system_instruction=system_instruction)
    if raw_reply and raw_reply.strip():
        reply_text = raw_reply.strip()
    else:
        # Heuristic fallback conversation responder
        if "sitting" in msg_lower or "capacity" in msg_lower or "hour" in msg_lower or "min" in msg_lower:
            cap_used = detected_capacity or current_sitting_capacity
            reply_text = (
                f"Got it! Setting your maximum sitting capacity to **{cap_used} minutes per session**.\n\n"
                f"With **{days_to_exam} days until {exam_name}**, studying in {cap_used}-minute blocks prevents cognitive fatigue and aligns with the brain's ultradian rhythm.\n\n"
                f"• **Recommended Rhythm**: {cap_used} mins focused study + 5-10 mins active break.\n"
                + (f"• **Yesterday's Recall**: You covered {', '.join([t.get('name', '') for t in yesterday_topics[:2]])}. I've prepared a quick 5-min mock test to lock those concepts in before new topics!\n" if yesterday_topics else "")
                + f"\nWould you like me to apply this smart schedule to your planner now?"
            )
        elif "yesterday" in msg_lower or "mock" in msg_lower or "test" in msg_lower:
            reply_text = (
                f"Testing yourself 24 hours after studying a topic is proven by cognitive science to triple long-term memory retention!\n\n"
                + (f"Yesterday you worked on **{', '.join([t.get('name', '') for t in yesterday_topics])}**.\n\n" if yesterday_topics else "Reviewing your previous topics with a mock test reveals weak spots before the real exam.\n\n")
                + f"You can click **'Start Yesterday's Mock Test'** to take a rapid 5-question test paper right now. Once completed, your syllabus readiness and next review schedule will auto-update!"
            )
        else:
            reply_text = (
                f"Hello! I am your StudyPilot AI Advisor for **{exam_name}** ({days_to_exam} days remaining).\n\n"
                f"To plan the most realistic schedule for your syllabus:\n\n"
                f"1. **What is your maximum sitting capacity for study in one stretch?** (e.g. 30m, 45m, 60m, or 90m?)\n"
                f"2. **How many hours per day** would you like to dedicate?\n\n"
                f"Tell me your preferences, or click any quick preset below, and I'll generate a personalized day-by-day plan with scheduled mock tests!"
            )

    return {
        "reply": reply_text,
        "detected_sitting_capacity": detected_capacity,
        "days_to_exam": days_to_exam,
        "has_yesterday_topics": bool(yesterday_topics and len(yesterday_topics) > 0)
    }

# -------------------------------------------------------------
# Full Syllabus Mock Test Service (60-Min & 3-Hour Tests)
# -------------------------------------------------------------

async def generate_full_syllabus_test(
    syllabus: List[Dict[str, Any]],
    duration_mins: int = 60,
    difficulty: str = "moderate",
    test_number: int = 1,
    num_questions: Optional[int] = None,
    subject_filter: Optional[str] = None,
    role: Optional[str] = "competitive_exam",
    api_key: Optional[str] = None
) -> Dict[str, Any]:
    """
    Generates examination papers:
    - Subject-wise separate papers (e.g., Physics Paper, Chemistry Paper) OR Full Syllabus Combined Paper.
    - Tailored to user role:
      - 'student': School / College Curriculum standard (no negative marking, conceptual depth).
      - 'competitive_exam': Competitive Entrance standard (+4/-1 negative marking, high analytical distractor density).
      - 'professional': Certification / Applied standard.
    - Strict adherence: Only uses real subjects & topics provided by user.
    """
    if not syllabus:
        return {
            "error": "no_syllabus",
            "message": "No syllabus found. Please upload your syllabus in PDF, Excel, or CSV format to generate real exam papers."
        }

    # Filter to specific subject if requested
    is_single_subject = False
    single_subj_name = ""
    if subject_filter and subject_filter.strip().lower() != "all":
        matched = [
            s for s in syllabus
            if s.get("name", "").strip().lower() == subject_filter.strip().lower() or s.get("id", "").strip().lower() == subject_filter.strip().lower()
        ]
        if matched:
            syllabus = matched
            is_single_subject = True
            single_subj_name = matched[0].get("name", "Subject")

    # Validate duration & question counts
    if duration_mins == 180:
        target_questions = num_questions or 75
    else:
        duration_mins = 60
        target_questions = num_questions or 30

    target_questions = max(5, min(100, target_questions))
    norm_diff = difficulty.lower() if difficulty.lower() in ["easy", "moderate", "difficult"] else "moderate"

    # Distribute questions proportionally across subjects
    all_subject_topics = []
    for s in syllabus:
        s_name = s.get("name", "General")
        s_id = s.get("id", "s_" + secrets.token_hex(2))
        topics = s.get("topics", [])
        if not topics:
            topics = [{"name": f"{s_name} Core Principles"}]
        all_subject_topics.append({
            "subject_id": s_id,
            "subject": s_name,
            "topics": [t.get("name", "Core Topic") if isinstance(t, dict) else str(t) for t in topics]
        })

    num_subjects = len(all_subject_topics)
    qs_per_subject = max(1, target_questions // max(1, num_subjects))

    used_questions = set()
    questions = []
    q_counter = 0

    # Seed-based offset using test_number so Test #1, Test #2, Test #3 get different questions
    test_seed_offset = (test_number - 1) * 19

    # Role-based tuning
    role_norm = role if role in ["student", "competitive_exam", "professional"] else "competitive_exam"
    marking_scheme = {
        "competitive_exam": {"correct": 4, "incorrect": -1, "type": "competitive", "label": "+4 for Correct, -1 for Incorrect (Competitive Marking)"},
        "student": {"correct": 1, "incorrect": 0, "type": "standard", "label": "1 Mark per Question (No Negative Marking)"},
        "professional": {"correct": 1, "incorrect": 0, "type": "certification", "label": "Standard Certification Grading"}
    }.get(role_norm, {"correct": 1, "incorrect": 0, "type": "standard", "label": "Standard Grading"})

    for subj_info in all_subject_topics:
        s_name = subj_info["subject"]
        s_id = subj_info["subject_id"]
        s_topics = subj_info["topics"]
        
        for k in range(qs_per_subject):
            if len(questions) >= target_questions:
                break
            q_counter += 1
            t_name = s_topics[(k + test_seed_offset) % len(s_topics)]
            
            q = generate_heuristic_question(
                topic_name=t_name,
                subject_name=s_name,
                question_index=test_seed_offset + q_counter,
                total_requested=target_questions,
                used_questions=used_questions,
                difficulty=norm_diff
            )
            q["id"] = f"q_{test_number}_{q_counter}_{secrets.token_hex(2)}"
            q["difficulty"] = norm_diff
            q["subject"] = s_name
            q["subjectId"] = s_id
            q["marking_correct"] = marking_scheme["correct"]
            q["marking_incorrect"] = marking_scheme["incorrect"]
            imp_data = get_topic_importance(t_name, s_name)
            q["importance"] = imp_data["importance"]
            q["weightage"] = imp_data.get("weightage", "")
            questions.append(q)

    # If any remaining slots to reach target_questions
    while len(questions) < target_questions:
        q_counter += 1
        subj_info = all_subject_topics[q_counter % len(all_subject_topics)]
        s_name = subj_info["subject"]
        s_id = subj_info["subject_id"]
        t_name = subj_info["topics"][q_counter % len(subj_info["topics"])]
        q = generate_heuristic_question(
            topic_name=t_name,
            subject_name=s_name,
            question_index=test_seed_offset + q_counter + 60,
            total_requested=target_questions,
            used_questions=used_questions,
            difficulty=norm_diff
        )
        q["id"] = f"q_{test_number}_{q_counter}_{secrets.token_hex(2)}"
        q["difficulty"] = norm_diff
        q["subject"] = s_name
        q["subjectId"] = s_id
        q["marking_correct"] = marking_scheme["correct"]
        q["marking_incorrect"] = marking_scheme["incorrect"]
        imp_data = get_topic_importance(t_name, s_name)
        q["importance"] = imp_data["importance"]
        q["weightage"] = imp_data.get("weightage", "")
        questions.append(q)

    if is_single_subject:
        if duration_mins == 180:
            title = f"🏆 {single_subj_name}: Comprehensive Grand Paper #{test_number} ({norm_diff.title()} Tier)"
        else:
            title = f"⚡ {single_subj_name}: 60-Minute Rapid Paper #{test_number} ({norm_diff.title()} Tier)"
    else:
        if duration_mins == 180:
            title = f"🏆 Full Syllabus Grand Mock Examination #{test_number} ({norm_diff.title()} Tier)"
        else:
            title = f"⚡ Full Syllabus 60-Minute Rapid Test #{test_number} ({norm_diff.title()} Tier)"

    return {
        "source": "heuristic_ai",
        "test_id": f"test_{secrets.token_hex(6)}",
        "test_type": "subject_paper" if is_single_subject else "full_syllabus",
        "subject": single_subj_name if is_single_subject else "All Subjects Combined",
        "title": title,
        "role": role_norm,
        "marking_scheme": marking_scheme,
        "duration_mins": duration_mins,
        "time_limit_mins": duration_mins,
        "difficulty": norm_diff,
        "test_number": test_number,
        "subjects": [s.get("name", "Subject") for s in syllabus],
        "total_questions": len(questions),
        "questions": questions,
        "created_at": datetime.now().isoformat()
    }


# =============================================================================
# 1. Flexible Learning Levels & Level Profiler
# =============================================================================

LEVEL_PROFILES = {
    "class_6_8": {
        "name": "Classes 6–8 (Middle School)",
        "vocabulary": "simple, vibrant, everyday language with relatable analogies and friendly encouragement",
        "depth": "foundational concepts, intuitive explanations, vivid real-world examples, visual descriptions",
        "question_style": "direct conceptual MCQs, fun matching exercises, and basic applications",
        "tone": "enthusiastic, warm, encouraging"
    },
    "class_9_10": {
        "name": "Classes 9–10 (Secondary School / CBSE / ICSE)",
        "vocabulary": "clear scientific & mathematical terminology with real-life context and structured breakdowns",
        "depth": "core principles, formal definitions, step-by-step mathematical reasoning, exam-focused key terms",
        "question_style": "CBSE board-style MCQs, assertion-reasoning, diagram interpretation, numericals",
        "tone": "supportive, structured, academic"
    },
    "class_11_12": {
        "name": "Classes 11–12 (Higher Secondary / Senior School)",
        "vocabulary": "rigorous academic terminology, mathematical derivations, formal scientific conventions",
        "depth": "deep theoretical foundation, multi-step derivations, edge cases, inter-concept links",
        "question_style": "board & competitive foundation questions (JEE/NEET foundation, CBSE 12th standards)",
        "tone": "analytical, precise, thorough"
    },
    "undergraduate": {
        "name": "Undergraduate Courses (B.Tech / B.Sc / B.A / B.Com)",
        "vocabulary": "industry-standard and university academic nomenclature, theoretical frameworks",
        "depth": "architectural trade-offs, algorithmic analysis, case studies, empirical methodologies",
        "question_style": "analytical reasoning, implementation trade-offs, conceptual problem solving",
        "tone": "professional, academic, comprehensive"
    },
    "postgraduate": {
        "name": "Postgraduate Courses (M.Tech / M.Sc / M.A / MBA)",
        "vocabulary": "advanced domain terminology, formal research citations, comparative paradigms",
        "depth": "in-depth comparative analysis, complex state transitions, theoretical proofs",
        "question_style": "higher-order analytical problems, multi-variable synthesis, critical evaluations",
        "tone": "intellectual, rigorous, scholarly"
    },
    "research": {
        "name": "Research & Higher Studies (PhD / M.Phil / Fellowships)",
        "vocabulary": "peer-reviewed research language, formal notation, epistemological clarity",
        "depth": "state-of-the-art literature review, open problems, mathematical rigor, paradigm boundaries",
        "question_style": "critical synthesis, proof sketches, experimental methodology critiques",
        "tone": "scholarly, peer-to-peer, exploratory"
    },
    "competitive": {
        "name": "Competitive Examinations (UGC NET, UPSC, SSC, Banking, GATE, NEET, JEE)",
        "vocabulary": "official examination syllabus conventions, precision key phrases, elimination strategies",
        "depth": "high-yield exam topics, recurring patterns, trap questions, shortcut formulas, memory mnemonics",
        "question_style": "timed examination pattern MCQs with negative marking penalties, assertion-reason, tricky distractors",
        "tone": "strategic, result-oriented, coach-like"
    },
    "custom": {
        "name": "Custom Goal / Self-Paced Lifelong Learner",
        "vocabulary": "accessible yet comprehensive, practical, focused on conceptual clarity",
        "depth": "conceptual clarity paired with immediate practical utility",
        "question_style": "knowledge verification and practical scenario checks",
        "tone": "adaptable, practical, motivating"
    }
}

def get_level_profile(level: str) -> Dict[str, str]:
    norm = level.lower().strip() if level else "competitive"
    return LEVEL_PROFILES.get(norm, LEVEL_PROFILES["competitive"])


# =============================================================================
# 2. Interactive AI Topic Learning Studio Engine
# =============================================================================

async def generate_interactive_topic_content(
    topic_name: str,
    subject_name: str = "General",
    exam_name: str = "Target Examination",
    education_level: str = "competitive",
    unit_name: str = "",
    learning_preferences: Optional[Dict[str, Any]] = None,
    api_key: Optional[str] = None,
    **kwargs
) -> Dict[str, Any]:
    """
    Generates level-adapted, rich interactive learning studio content for any syllabus topic:
    - Summary & Prerequisites
    - Section-by-section exploration (with real-life examples, analogies, formulas/code, diagrams)
    - Interactive elements (flashcards, flipcards, mini-quiz, matching pairs, worked examples, mnemonics)
    - Key takeaways & 3 comprehension checks
    """
    profile = get_level_profile(education_level)
    level_name = profile["name"]
    vocab = profile["vocabulary"]
    depth = profile["depth"]

    system_instruction = (
        f"You are StudyPilot AI's Senior Interactive Tutor. The learner is studying at the '{level_name}' level. "
        f"Adopt vocabulary style: '{vocab}'. Content depth: '{depth}'. "
        f"Always return valid JSON adhering strictly to the requested schema. Avoid dense walls of text. "
        f"Use relatable analogies, real-life examples, and structured sections."
    )

    prompt = f"""
    Create a complete, interactive, section-by-section learning studio package for:
    Topic: "{topic_name}"
    Subject: "{subject_name}"
    Exam / Learning Goal: "{exam_name}"
    Education Level: "{level_name}"

    Return ONLY a JSON object with this exact structure:
    {{
        "summary": "Clear, engaging 2-3 sentence overview suitable for {level_name}",
        "prerequisites": ["Prerequisite Concept 1", "Prerequisite Concept 2"],
        "sections": [
            {{
                "id": "sec_1",
                "title": "1. Core Concept Introduction",
                "content": "Clear, bite-sized explanation without jargon walls...",
                "real_life_example": "Concrete everyday scenario or real-world application...",
                "analogy": "Memorable analogy suitable for {level_name}...",
                "formula_or_code": "Relevant formula, snippet, or step-by-step logic (or null if purely qualitative)",
                "diagram_concept": "Visual description or flowchart layout for mental imagery"
            }},
            {{
                "id": "sec_2",
                "title": "2. Working Mechanism & Step-by-Step Breakdown",
                "content": "How it works, key phases, rules, or components...",
                "real_life_example": "Another vivid practical application...",
                "analogy": "Analogy clarifying edge cases...",
                "formula_or_code": "Working formula or example...",
                "diagram_concept": "Step-by-step state transition or hierarchy"
            }},
            {{
                "id": "sec_3",
                "title": "3. Critical Applications & Exam Traps",
                "content": "Common pitfalls, edge cases, and high-yield insights...",
                "real_life_example": "Where students make mistakes or real system failure scenario...",
                "analogy": "Mnemonic or mental checklist...",
                "formula_or_code": null,
                "diagram_concept": "Comparison matrix or decision tree"
            }}
        ],
        "interactive_elements": {{
            "flashcards": [
                {{"id": "fc_1", "front": "Key Term / Question 1", "back": "Precise definition / fact", "tag": "Core Definition"}},
                {{"id": "fc_2", "front": "Key Term / Question 2", "back": "Precise definition / fact", "tag": "Formula / Rule"}},
                {{"id": "fc_3", "front": "Key Term / Question 3", "back": "Precise definition / fact", "tag": "Exam Insight"}}
            ],
            "flip_cards": [
                {{"id": "fl_1", "question": "Why does this principle hold true?", "answer": "Detailed answer explaining the underlying cause.", "hint": "Think of conservation / equilibrium."}},
                {{"id": "fl_2", "question": "What is the primary trade-off?", "answer": "Explanation of balance between speed vs memory or cost vs accuracy.", "hint": "Asymptotic bounds."}}
            ],
            "mini_quiz": [
                {{
                    "question": "Conceptual check question testing understanding...",
                    "options": ["Option A", "Option B", "Option C", "Option D"],
                    "correct_idx": 1,
                    "explanation": "Why Option B is correct and others are distractors."
                }},
                {{
                    "question": "Second check question testing real-world application...",
                    "options": ["Choice 1", "Choice 2", "Choice 3", "Choice 4"],
                    "correct_idx": 0,
                    "explanation": "Logical justification based on core rules."
                }}
            ],
            "matching_pairs": [
                {{"left": "Concept A", "right": "Matching Characteristic A"}},
                {{"left": "Concept B", "right": "Matching Characteristic B"}},
                {{"left": "Concept C", "right": "Matching Characteristic C"}}
            ],
            "worked_examples": [
                {{
                    "problem": "Clear problem statement matching {level_name} level...",
                    "steps": [
                        "Step 1: Identify given parameters and constraints.",
                        "Step 2: Apply the governing principle or formula.",
                        "Step 3: Simplify and verify boundary conditions."
                    ],
                    "final_answer": "Final derived result or conclusion."
                }}
            ],
            "mnemonics": [
                {{"trick_phrase": "Clever Memory Acronym / Phrase", "memory_explanation": "How to recall the sequence or essential formula."}}
            ]
        }},
        "key_takeaways": [
            "Essential Point 1",
            "Essential Point 2",
            "Essential Point 3",
            "Essential Point 4"
        ],
        "comprehension_checks": [
            {{
                "question": "Comprehension Check 1: Fundamental Concept",
                "options": ["Incorrect distractor 1", "Correct foundational answer", "Plausible misconception", "Unrelated fact"],
                "correct_index": 1,
                "explanation": "Explains why this check verifies basic comprehension."
            }},
            {{
                "question": "Comprehension Check 2: Applied Scenario",
                "options": ["Correct practical outcome", "Overestimated outcome", "Zero change", "Reverse effect"],
                "correct_index": 0,
                "explanation": "Explains the application logic."
            }},
            {{
                "question": "Comprehension Check 3: Edge Case / Distinction",
                "options": ["Distractor A", "Distractor B", "Correct distinction", "Distractor D"],
                "correct_index": 2,
                "explanation": "Details the subtle difference tested."
            }}
        ]
    }}
    """

    llm_output = await call_llm(prompt, api_key=api_key, system_instruction=system_instruction, json_mode=True)
    if llm_output:
        try:
            # Clean markdown codeblocks if present
            cleaned = llm_output.strip()
            if cleaned.startswith("```json"):
                cleaned = cleaned[7:]
            if cleaned.startswith("```"):
                cleaned = cleaned[3:]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            parsed = json.loads(cleaned.strip())
            if "sections" in parsed and "interactive_elements" in parsed:
                parsed["source"] = "ai_generated"
                parsed["education_level"] = education_level
                # Guarantee all 13 sections exist
                fallback_pkg = generate_heuristic_topic_learning_studio(topic_name, subject_name, exam_name, education_level)
                for key_13 in [
                    "topic_introduction", "learning_objectives", "simple_explanation",
                    "detailed_explanation", "important_definitions", "step_by_step_examples",
                    "real_world_applications", "important_formulas", "diagrams_and_visuals",
                    "points_to_remember", "topic_summary", "practice_questions", "faqs"
                ]:
                    if key_13 not in parsed or not parsed[key_13]:
                        parsed[key_13] = fallback_pkg[key_13]
                return parsed
        except Exception as e:
            print(f"[AI Learning Studio Warning] JSON parsing error: {e}. Falling back to heuristic generator.")

    # High-Quality Level-Adapted Heuristic Fallback
    return generate_heuristic_topic_learning_studio(topic_name, subject_name, exam_name, education_level)


def generate_heuristic_topic_learning_studio(
    topic_name: str,
    subject_name: str,
    exam_name: str,
    education_level: str
) -> Dict[str, Any]:
    """
    Robust fallback generating structured, interactive learning studio content tailored to the education level.
    """
    profile = get_level_profile(education_level)
    level_name = profile["name"]
    is_school = education_level in ["class_6_8", "class_9_10"]
    is_advanced = education_level in ["undergraduate", "postgraduate", "research"]

    clean_t = topic_name.strip()
    clean_s = subject_name.strip()

    if is_school:
        summary = f"{clean_t} is an exciting and fundamental topic in {clean_s}. It helps us understand how things work in the world around us through easy observations and clear rules."
        ex1 = f"Imagine baking a cake or riding a bicycle: {clean_t} operates just like a step-by-step recipe where every part has a special job to do."
        analogy1 = "Think of it like a team of players on a field: each rule works together so the entire system plays smoothly."
    elif is_advanced:
        summary = f"{clean_t} represents a foundational theoretical and applied construct within {clean_s}, governing formal state transitions, invariant constraints, and optimization boundaries."
        ex1 = f"In large-scale production architectures and scientific models, {clean_t} dictates critical latency boundaries and reliability guarantees."
        analogy1 = "Consider it as the protocol layer in distributed computing: strict contractual interfaces maintaining coherence across heterogeneous nodes."
    else:
        summary = f"{clean_t} is a core high-yield topic in {clean_s} for {exam_name}. Mastering its theoretical principles, typical edge cases, and problem-solving patterns is essential for competitive success."
        ex1 = f"A classic real-world scenario involves balance and rate of exchange: where {clean_t} governs efficiency limits and resource equilibrium."
        analogy1 = "Think of it as a well-calibrated gearbox: adjusting input variables directly dictates output torque and throughput."

    sections = [
        {
            "id": "sec_1",
            "title": f"1. Foundations of {clean_t}",
            "content": f"At its core, {clean_t} establishes the foundational relationship between key entities in {clean_s}. Understanding this concept begins by identifying the active variables, their physical or logical meaning, and the boundary conditions under which they operate.",
            "real_life_example": ex1,
            "analogy": analogy1,
            "formula_or_code": f"Core Principle: Primary Entity ∝ Characteristic Rate of {clean_t}" if not is_school else f"Rule: When Input changes, {clean_t} produces a balanced Result",
            "diagram_concept": f"Flow diagram illustrating: Input Stimulus → Process Rule of {clean_t} → Output State"
        },
        {
            "id": "sec_2",
            "title": f"2. Operational Mechanisms & Step-by-Step Breakdown",
            "content": f"When applying {clean_t}, we observe a structured sequence of transformations. By breaking the process into distinct stages, you can isolate what stays constant (the invariant) versus what transforms dynamically.",
            "real_life_example": f"Observing real-time changes when {clean_t} is subjected to stress or maximum capacity.",
            "analogy": "Like checkpoints in a marathon: each phase confirms balance before the next phase activates.",
            "formula_or_code": "Step 1: Validate Initial State\nStep 2: Apply Governing Law of " + clean_t + "\nStep 3: Verify Conservation & Limits",
            "diagram_concept": f"State transition matrix showing Phase 1 (Initial) -> Phase 2 (Transition) -> Phase 3 (Steady State)"
        },
        {
            "id": "sec_3",
            "title": f"3. Examination Traps, Edge Cases & Synthesis",
            "content": f"Examination questions frequently test boundary conditions where intuitive assumptions fail. Keep a sharp eye on hidden constraints, unit conversions, and conditions where the standard formula no longer applies directly.",
            "real_life_example": f"Common exam trap: confusing inverse relationships with linear changes in {clean_t}.",
            "analogy": "A speed limit sign: it works perfectly on highways, but special school-zone rules override it when pedestrians are present.",
            "formula_or_code": "Caution Checklist:\n- Are dimensions consistent?\n- Are external disturbances zero?\n- Does the boundary test hold?",
            "diagram_concept": "Decision tree distinguishing standard cases from exception / edge cases"
        }
    ]

    interactive_elements = {
        "flashcards": [
            {
                "id": "fc_1",
                "front": f"What is the primary definition of {clean_t}?",
                "back": f"The governing concept in {clean_s} that explains the state, transformation, and fundamental behavior of its active elements.",
                "tag": "Core Definition"
            },
            {
                "id": "fc_2",
                "front": f"What is the single most common pitfall when solving problems in {clean_t}?",
                "back": "Failing to check boundary constraints or assuming linearity where non-linear or threshold conditions apply.",
                "tag": "Exam Trap"
            },
            {
                "id": "fc_3",
                "front": f"What invariant is preserved during {clean_t} operations?",
                "back": "Total energy, momentum, charge, or logical integrity remains conserved under closed system assumptions.",
                "tag": "Key Law"
            }
        ],
        "flip_cards": [
            {
                "id": "fl_1",
                "question": f"Why does understanding {clean_t} matter beyond memorizing the formula?",
                "answer": "Formulas are only valid under specific assumptions. Understanding the core concept lets you solve non-standard exam problems effortlessly.",
                "hint": "Focus on the 'why' rather than just the 'what'."
            },
            {
                "id": "fl_2",
                "question": f"How can you quickly sanity-check an answer involving {clean_t}?",
                "answer": "Perform dimensional analysis and test extreme values (zero and infinity) to verify logical consistency.",
                "hint": "Boundary testing."
            }
        ],
        "mini_quiz": [
            {
                "question": f"Under standard conditions, which statement accurately characterizes {clean_t} in {clean_s}?",
                "options": [
                    f"It operates independently of any surrounding constraints",
                    f"It describes a deterministic relationship governed by physical or logical conservation laws",
                    f"It only applies when external resistance is infinite",
                    f"It was superseded and is no longer relevant in modern curricula"
                ],
                "correct_idx": 1,
                "explanation": f"In {clean_s}, {clean_t} is universally grounded in fundamental conservation and deterministic rules."
            },
            {
                "question": f"When solving an examination question on {clean_t}, what is the first recommended step?",
                "options": [
                    "Immediately write down numbers without reading units",
                    "Identify the system boundary, given parameters, and governing law",
                    "Guess the choice that has the largest number",
                    "Skip directly to the final formula without verifying assumptions"
                ],
                "correct_idx": 1,
                "explanation": "Proper problem decomposition prevents misapplying formulas to out-of-boundary problems."
            }
        ],
        "matching_pairs": [
            {"left": f"{clean_t} Definition", "right": "Foundational behavioral principle"},
            {"left": "Standard Assumption", "right": "Closed or equilibrium system"},
            {"left": "Verification Method", "right": "Boundary and dimensional check"},
            {"left": "Exam Pitfall", "right": "Unverified linearity assumption"}
        ],
        "worked_examples": [
            {
                "problem": f"Given a scenario in {clean_s} involving {clean_t}, explain how to compute the resulting equilibrium state.",
                "steps": [
                    f"Step 1: List all input parameters and state the governing equation for {clean_t}.",
                    "Step 2: Check boundary values to ensure the equations apply cleanly.",
                    "Step 3: Solve for the unknown variable while tracking dimensional consistency.",
                    "Step 4: Verify that the result satisfies fundamental physical or logical limits."
                ],
                "final_answer": f"The equilibrium state is uniquely determined and verified against the boundary conditions of {clean_t}."
            }
        ],
        "mnemonics": [
            {
                "trick_phrase": "I-D-E-A-L (Identify, Define, Equation, Apply, Limit)",
                "memory_explanation": f"Use IDEAL to tackle any question in {clean_t}: Identify the system, Define variables, pick the Equation, Apply substitutions, check the Limit!"
            }
        ]
    }

    comprehension_checks = [
        {
            "question": f"Comprehension Check 1: What is the primary role of {clean_t}?",
            "options": [
                f"To act as an optional footnote in {clean_s}",
                f"To establish the fundamental relationship governing system transformation and balance",
                f"To increase complexity without practical utility",
                f"To replace experimental observation with guesswork"
            ],
            "correct_index": 1,
            "explanation": f"{clean_t} is fundamental because it provides the exact governing relationship for the system."
        },
        {
            "question": f"Comprehension Check 2: When external constraints are modified, what happens to {clean_t}?",
            "options": [
                "The system dynamically shifts toward a new equilibrium dictated by the governing law",
                "The system immediately collapses with no predictable outcome",
                "Nothing changes under any circumstances",
                "The laws of logic become undefined"
            ],
            "correct_index": 0,
            "explanation": "Dynamic equilibrium adjusts predictably according to the system's governing constraints."
        },
        {
            "question": f"Comprehension Check 3: Which strategy guarantees high accuracy when answering exam questions on {clean_t}?",
            "options": [
                "Memorizing only the final answer without steps",
                "Relying solely on visual intuition without verification",
                "Checking dimensions, boundary cases, and initial system assumptions",
                "Answering randomly within the first 5 seconds"
            ],
            "correct_index": 2,
            "explanation": "Systematic verification of dimensions and boundary limits prevents common examiner traps."
        }
    ]

    # The 13 Specific Structured Educational Sections (Requirement 5)
    sec_13_intro = f"{clean_t} is a core academic topic in {clean_s} that forms an essential portion of {exam_name}. Mastering its fundamentals ensures high accuracy across conceptual questions and numerical applications."
    sec_13_objs = [
        f"Master the core definitions, fundamental laws, and mechanisms of {clean_t}.",
        f"Analyze input-output transformations and boundary equilibrium states in {clean_s}.",
        f"Solve step-by-step examination problems using standard formulas and dimensional checks.",
        "Recognize common pitfalls, distractor patterns, and edge cases in examination questions."
    ]
    sec_13_simple = f"In simple terms, {clean_t} functions like a well-balanced system: when you modify an input factor, the governing rules of {clean_s} dynamically produce a balanced result. " + analogy1
    sec_13_detailed = f"From a rigorous academic standpoint, {clean_t} establishes the foundational relationships governing active variables in {clean_s}. It determines state transformations under operational load, boundary constraints, and conservation laws. Analyzing any problem requires decomposing the system into invariant quantities (which remain preserved) and dynamic variables (which change systematically)."
    sec_13_defs = [
        {"term": f"{clean_t}", "definition": f"The governing concept in {clean_s} that defines the state, transformation, and fundamental behavior of its active elements."},
        {"term": "Boundary Condition", "definition": "The limiting physical, mathematical, or logical constraints within which the governing laws operate."},
        {"term": "Invariant Constraint", "definition": "A fundamental quantity or parity (such as energy, charge, or continuity) that remains conserved throughout the transformation."}
    ]
    sec_13_examples = [
        {
            "title": f"Standard {clean_t} Problem",
            "problem": f"A system in {clean_s} is subject to operational stimulus governed by {clean_t}. Determine the resulting equilibrium state.",
            "steps": [
                "Step 1: Extract and list all given parameters, initial conditions, and units.",
                f"Step 2: Identify and write down the governing formula for {clean_t}.",
                "Step 3: Substitute the known values and simplify the expressions algebraically.",
                "Step 4: Check dimensional consistency and test boundary limits to confirm the answer."
            ],
            "solution": f"The equilibrium state is uniquely determined and verified against the boundary constraints of {clean_t}."
        }
    ]
    sec_13_apps = [
        ex1,
        f"Practical engineering and systems design: optimizing resource throughput in {clean_s}.",
        f"Modern research & diagnostics: modeling state changes and prediction curves in {clean_t}."
    ]
    sec_13_formulas = [
        {
            "name": f"Core Equation of {clean_t}",
            "formula": f"Rate({clean_t}) = k \\cdot \\frac{{\\Delta S}}{{\\Delta t}}",
            "description": "Relates the rate of system transformation to the active driving gradient.",
            "variables": ["k: Proportionality constant", "ΔS: Net change in driving state", "Δt: Time / Iteration interval"]
        }
    ]
    sec_13_diagrams = {
        "title": f"{clean_t} Operational Architecture",
        "description": f"Visual breakdown showing Input Stimulus transforming into Stable Output under the rules of {clean_t}.",
        "ascii_art": f"[Input State] ---> | Rule of {clean_t} | ---> [Equilibrium Output]\n         ^                      |\n         |--- Feedback Loop ----|",
        "diagram_svg": f"<svg viewBox='0 0 620 140' width='100%' height='140'><rect x='20' y='42' width='125' height='52' rx='10' fill='#141E2A' stroke='#0A6C9E' stroke-width='1.5'/><text x='82' y='73' fill='#E8EEF4' font-size='12' font-family='system-ui, sans-serif' text-anchor='middle'>Input Stimulus</text><line x1='145' y1='68' x2='195' y2='68' stroke='#54C2F0' stroke-width='2.5' stroke-dasharray='4'/><polygon points='195,68 188,64 188,72' fill='#54C2F0'/><rect x='195' y='28' width='230' height='80' rx='14' fill='#0A6C9E' stroke='#54C2F0' stroke-width='1.5'/><foreignObject x='195' y='28' width='230' height='80'><div xmlns='http://www.w3.org/1999/xhtml' style='display:flex;align-items:center;justify-content:center;height:100%;text-align:center;color:#ffffff;font-size:13px;font-weight:700;line-height:1.25;padding:6px 14px;font-family:system-ui,sans-serif;word-break:break-word;overflow:hidden;'>{clean_t}</div></foreignObject><line x1='425' y1='68' x2='475' y2='68' stroke='#4CC98A' stroke-width='2.5'/><polygon points='475,68 468,64 468,72' fill='#4CC98A'/><rect x='475' y='42' width='125' height='52' rx='10' fill='#1B8553' stroke='#4CC98A' stroke-width='1.5'/><text x='537' y='73' fill='#ffffff' font-size='12' font-family='system-ui, sans-serif' text-anchor='middle'>Stable Output</text></svg>"
    }
    sec_13_points = [
        f"Always check dimensional units before substituting values into {clean_t} formulas.",
        "Verify whether standard linearity holds or if non-linear threshold rules apply.",
        f"Distinguish between internal state properties and external system influences in {clean_s}.",
        "Re-check boundary conditions if an answer yields an extreme or unexpected magnitude."
    ]
    sec_13_practice = [
        {
            "question": f"Which statement best summarizes the primary operational mechanism of {clean_t}?",
            "options": [
                f"It functions randomly with no predictable constraints",
                f"It governs a deterministic state transition preserving invariant system properties",
                f"It only holds when temperature and pressure are zero",
                f"It is an obsolete concept with no competitive examination relevance"
            ],
            "correct_idx": 1,
            "solution": f"In {clean_s}, {clean_t} enforces deterministic relationships that preserve conservation laws.",
            "hint": "Consider the role of invariants and conservation in systems."
        },
        {
            "question": f"When solving an examination question on {clean_t}, which step should always precede numerical calculation?",
            "options": [
                "Selecting the option with the largest value",
                "Checking the system boundary, given parameters, and dimensional consistency",
                "Ignoring SI unit prefixes",
                "Applying integration without checking limits"
            ],
            "correct_idx": 1,
            "solution": "Checking system boundaries and units guarantees that equations are not misapplied to out-of-scope regimes.",
            "hint": "Think about sanity-checking problem assumptions."
        }
    ]
    sec_13_faqs = [
        {
            "question": f"Why is {clean_t} tested so frequently in {exam_name}?",
            "answer": f"Because it tests both conceptual comprehension and mathematical problem-solving ability, making it an ideal differentiator for entrance ranks."
        },
        {
            "question": f"What is the best technique to quickly master {clean_t}?",
            "answer": f"Start with the simple analogy, master the 3 core definitions, practice the worked example step-by-step, and test yourself on the mini-quiz and flashcards."
        }
    ]

    return {
        "source": "heuristic_studio",
        "education_level": education_level,
        "summary": summary,
        "topic_introduction": sec_13_intro,
        "learning_objectives": sec_13_objs,
        "simple_explanation": sec_13_simple,
        "detailed_explanation": sec_13_detailed,
        "important_definitions": sec_13_defs,
        "step_by_step_examples": sec_13_examples,
        "real_world_applications": sec_13_apps,
        "important_formulas": sec_13_formulas,
        "diagrams_and_visuals": sec_13_diagrams,
        "points_to_remember": sec_13_points,
        "topic_summary": summary,
        "practice_questions": sec_13_practice,
        "faqs": sec_13_faqs,
        "prerequisites": [
            f"Basic terminology in {clean_s}",
            "Fundamental arithmetic & logical reasoning",
            "Concept of equilibrium and state transitions"
        ],
        "sections": sections,
        "interactive_elements": interactive_elements,
        "key_takeaways": [
            f"{clean_t} governs the balance and operational flow of {clean_s}.",
            "Always verify boundary conditions and dimensional units before applying standard formulas.",
            "Identify what is conserved vs what transforms dynamically.",
            "Use the IDEAL problem-solving framework for guaranteed exam accuracy."
        ],
        "comprehension_checks": comprehension_checks
    }


# =============================================================================
# 3. In-Topic Conversational AI Tutor ("Ask AI Tutor")
# =============================================================================

async def chat_with_topic_tutor(
    topic_name: str,
    subject_name: str,
    education_level: str,
    history: List[Dict[str, str]],
    user_query: str,
    api_key: Optional[str] = None
) -> str:
    """
    Conversational AI tutor embedded inside a specific syllabus topic.
    Responds at the student's exact education level with clarity, analogies, and step-by-step guidance.
    """
    profile = get_level_profile(education_level)
    level_name = profile["name"]
    vocab = profile["vocabulary"]
    depth = profile["depth"]

    system_instruction = (
        f"You are StudyPilot's personal AI Tutor for the topic '{topic_name}' in subject '{subject_name}'. "
        f"The user is at the '{level_name}' education level. "
        f"Use vocabulary style: '{vocab}'. Content depth: '{depth}'. "
        f"Keep answers clear, encouraging, structured, and focused strictly on the topic. "
        f"Break down difficult points into steps. Use relatable analogies when helpful."
    )

    # Format conversation history
    context_msgs = []
    for h in history[-6:]:
        role = "User" if h.get("role") == "user" else "Assistant"
        context_msgs.append(f"{role}: {h.get('message', '')}")
    history_block = "\n".join(context_msgs)

    prompt = f"""
    Context Topic: "{topic_name}" ({subject_name})
    Target Education Level: {level_name}

    Conversation History:
    {history_block}

    User Question: "{user_query}"

    Provide a helpful, direct, and pedagogically sound explanation tailored to {level_name}.
    If the user asks for a simpler explanation, use everyday analogies.
    If the user asks for step-by-step problem solving, enumerate each step clearly.
    """

    llm_output = await call_llm(prompt, api_key=api_key, system_instruction=system_instruction)
    if llm_output and len(llm_output.strip()) > 10:
        return llm_output.strip()

    # Heuristic Fallback Response
    q_low = user_query.lower()
    if "simple" in q_low or "beginner" in q_low or "explain like" in q_low:
        return (
            f"Here is the simplest way to understand **{topic_name}**:\n\n"
            f"Think of it like a familiar real-world balance. Whenever you change one factor in {subject_name}, "
            f"the other factors adjust so that the total balance is preserved. "
            f"You don't need complicated math right now — just remember the golden rule: **Input drives the process, and the rules of {topic_name} decide the outcome!**"
        )
    elif "example" in q_low:
        return (
            f"Here is a great real-life example of **{topic_name}**:\n\n"
            f"Consider a water filtration plant or a smartphone battery charging curve. "
            f"At first, the rate of flow is high, but as capacity fills up, the resistance increases to maintain equilibrium. "
            f"In **{topic_name}**, the exact same principle applies: changes happen fast initially, then stabilize into a steady state."
        )
    elif "step" in q_low or "solve" in q_low:
        return (
            f"Here is the 3-step master method for **{topic_name}**:\n\n"
            f"1. **State the Given Data**: Write down what parameters you know and their units.\n"
            f"2. **Apply the Core Relationship**: Use the governing principle of {topic_name} to relate the unknown variable to the knowns.\n"
            f"3. **Check the Limits**: Check whether your answer makes physical or logical sense at extreme values (e.g. zero or infinity)!"
        )
    elif "test" in q_low or "quiz" in q_low:
        return (
            f"Let's test your understanding of **{topic_name}** right now!\n\n"
            f"**Question**: In {subject_name}, what happens to the output of {topic_name} if you double the primary input while keeping all other variables constant?\n\n"
            f"*(Think carefully: Does it double, halve, or remain constant? Reply with your reasoning and I'll review it!)*"
        )
    else:
        return (
            f"Great question about **{topic_name}** in {subject_name}!\n\n"
            f"At the {level_name} level, the key takeaway is that {topic_name} connects the underlying rules of {subject_name} with practical results. "
            f"Always look at what is conserved and what boundary limits exist. "
            f"Would you like me to show a step-by-step example, explain it with a fun analogy, or quiz you on this concept?"
        )


# =============================================================================
# 4. Topic-Wise Question Practice & Detailed Evaluation
# =============================================================================

async def generate_topic_practice_questions(
    topic_name: str,
    subject_name: str,
    education_level: str = "competitive",
    difficulty: str = "intermediate",
    num_questions: int = 5,
    api_key: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Generates topic-wise questions at specified difficulty:
    - beginner, easy, intermediate, advanced, exam_level
    Includes question, options, correct answer, step-by-step explanation, mistake analysis, and hints.
    """
    profile = get_level_profile(education_level)
    level_name = profile["name"]
    q_count = max(3, min(15, num_questions))

    system_instruction = (
        f"You are a master question creator for '{level_name}'. "
        f"Generate {q_count} rigorous, high-quality practice questions for the topic '{topic_name}' in '{subject_name}'. "
        f"Target difficulty: '{difficulty}'. Return ONLY a JSON list of questions."
    )

    prompt = f"""
    Generate {q_count} practice questions for:
    Topic: "{topic_name}"
    Subject: "{subject_name}"
    Education Level: "{level_name}"
    Difficulty: "{difficulty}" (Levels: beginner, easy, intermediate, advanced, exam_level)

    Return ONLY a JSON array with objects matching this schema:
    [
        {{
            "id": "tpq_1",
            "question_text": "Precise question testing {difficulty} level concept...",
            "question_type": "single_choice",
            "options": ["Option A", "Option B", "Option C", "Option D"],
            "correct_answer": "Option B",
            "correct_index": 1,
            "explanation": "Clear, complete explanation of why Option B is correct...",
            "mistake_analysis": "Common misunderstanding: Students frequently pick Option A because...",
            "hint": "Remember the fundamental law of conservation...",
            "difficulty": "{difficulty}",
            "prerequisite_topic": "Foundational prerequisite to review if struggling"
        }}
    ]
    """

    llm_output = await call_llm(prompt, api_key=api_key, system_instruction=system_instruction, json_mode=True)
    if llm_output:
        try:
            cleaned = llm_output.strip()
            if cleaned.startswith("```json"):
                cleaned = cleaned[7:]
            if cleaned.startswith("```"):
                cleaned = cleaned[3:]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            parsed = json.loads(cleaned.strip())
            if isinstance(parsed, dict) and "questions" in parsed:
                parsed = parsed["questions"]
            if isinstance(parsed, list) and len(parsed) > 0:
                for idx, q in enumerate(parsed):
                    if "id" not in q:
                        q["id"] = f"tpq_{idx+1}_{secrets.token_hex(2)}"
                    q["difficulty"] = difficulty
                    q["topic_name"] = topic_name
                    q["subject_name"] = subject_name
                return parsed
        except Exception as e:
            print(f"[Practice Generator Warning] LLM parse error: {e}. Falling back to heuristic question bank.")

    # High-quality heuristic fallback questions
    return generate_heuristic_practice_questions(topic_name, subject_name, education_level, difficulty, q_count)


def generate_heuristic_practice_questions(
    topic_name: str,
    subject_name: str,
    education_level: str,
    difficulty: str,
    count: int
) -> List[Dict[str, Any]]:
    clean_t = topic_name.strip()
    clean_s = subject_name.strip()
    questions = []

    templates = [
        {
            "q": f"Which fundamental relationship is the cornerstone of {clean_t} in {clean_s}?",
            "opts": [
                f"Direct linear invariance regardless of boundary changes",
                f"State transitions governed by the core conservation laws of {clean_s}",
                f"Static independence from all surrounding physical or logical variables",
                f"Random fluctuations without deterministic convergence"
            ],
            "ans": 1,
            "exp": f"In {clean_s}, {clean_t} operates through deterministic state transitions bound by conservation principles.",
            "mistake": "Don't assume systems operate in complete independence; boundary conditions always couple variables.",
            "hint": "Look for the choice highlighting conservation and deterministic transition."
        },
        {
            "q": f"When analyzing {clean_t} under {difficulty} constraints, what is the critical invariant that must be maintained?",
            "opts": [
                "System equilibrium and relational consistency",
                "Maximum entropy with zero useful output",
                "Arbitrary variable scaling without dimensional balance",
                "Total cessation of all state transitions"
            ],
            "ans": 0,
            "exp": "Relational consistency and equilibrium preservation are essential invariants across all problem variations.",
            "mistake": "Students often neglect verifying that units and equilibrium conditions hold throughout the derivation.",
            "hint": "Think about what must stay conserved when the system transitions."
        },
        {
            "q": f"In an examination scenario involving {clean_t}, what unexpected effect occurs if primary constraints are doubled?",
            "opts": [
                "The system ceases to function completely",
                "The response follows a non-linear threshold governed by the system's rate equation",
                "The output doubles in an unconstrained linear fashion",
                "Nothing changes under any circumstance"
            ],
            "ans": 1,
            "exp": "Real-world and examination systems frequently exhibit non-linear response curves rather than naive linear scaling.",
            "mistake": "The most common trap is assuming direct 1-to-1 linear proportionality without checking rate equations.",
            "hint": "Be alert for non-linear saturation or threshold behavior."
        },
        {
            "q": f"Which diagnostic check provides the fastest verification of an answer derived for {clean_t}?",
            "opts": [
                "Comparing with arbitrary random numbers",
                "Testing extreme boundary limits (zero, infinity) and checking dimensional consistency",
                "Assuming the longest option is always correct",
                "Ignoring units entirely"
            ],
            "ans": 1,
            "exp": "Dimensional analysis combined with extreme-value boundary testing instantly exposes algebraic errors.",
            "mistake": "Rushing through calculation without sanity-checking units is the leading cause of negative marks.",
            "hint": "What simple check tells you if units or limits are broken?"
        },
        {
            "q": f"Why is {clean_t} considered a high-priority topic for {subject_name} examinations?",
            "opts": [
                "It has no practical application in real life",
                "It synthesizes multiple foundational concepts and tests analytical problem-solving skills",
                "It was only added to the syllabus as an afterthought",
                "It requires zero preparation or conceptual clarity"
            ],
            "ans": 1,
            "exp": "Examiners favor topics like this because they effectively discriminate between rote memorization and deep conceptual understanding.",
            "mistake": "Memorizing standard question patterns without understanding underlying mechanisms leads to failure on modified exam questions.",
            "hint": "Consider why examiners choose questions that bridge multiple concepts."
        }
    ]

    for idx in range(count):
        tmpl = templates[idx % len(templates)]
        questions.append({
            "id": f"tpq_{idx+1}_{secrets.token_hex(2)}",
            "question_text": tmpl["q"],
            "question_type": "single_choice",
            "options": tmpl["opts"],
            "correct_answer": tmpl["opts"][tmpl["ans"]],
            "correct_index": tmpl["ans"],
            "explanation": tmpl["exp"],
            "mistake_analysis": tmpl["mistake"],
            "hint": tmpl["hint"],
            "difficulty": difficulty,
            "prerequisite_topic": f"Foundations of {clean_s}"
        })

    return questions


def evaluate_topic_practice_answer(
    question_data: Optional[Dict[str, Any]] = None,
    user_answer: Any = None,
    question_text: Optional[str] = None,
    correct_answer: Optional[str] = None,
    topic_title: Optional[str] = None,
    difficulty: Optional[str] = None,
    education_level: Optional[str] = None,
    **kwargs
) -> Dict[str, Any]:
    """
    Evaluates student response, returns correctness, comprehensive explanation,
    mistake analysis, and prerequisite recommendations.
    """
    if question_data is None:
        question_data = {
            "question_text": question_text or "Question",
            "correct_answer": correct_answer or "",
            "explanation": f"The correct answer '{correct_answer}' directly follows from the governing principles of {topic_title or 'this topic'}.",
            "mistake_analysis": f"Review boundary conditions and basic rules for {topic_title or 'this topic'}.",
            "hint": f"Consider the core definitions and invariants of {topic_title or 'this topic'}.",
            "prerequisite_topic": f"Fundamentals of {topic_title or 'this topic'}"
        }

    correct_idx = question_data.get("correct_index", 0)
    options = question_data.get("options", [])
    correct_text = question_data.get("correct_answer") or (options[correct_idx] if options and len(options) > correct_idx else "")

    is_correct = False
    if isinstance(user_answer, int):
        is_correct = (user_answer == correct_idx)
    elif user_answer is not None:
        user_str = str(user_answer).strip().lower()
        if user_str == str(correct_idx):
            is_correct = True
        elif correct_text and user_str == correct_text.strip().lower():
            is_correct = True
        elif correct_answer and user_str == str(correct_answer).strip().lower():
            is_correct = True

    explanation = question_data.get("explanation", f"The selected answer adheres to the governing principles of {topic_title or 'this concept'}.")
    mistake_analysis = question_data.get("mistake_analysis", f"Review the underlying conditions and typical pitfalls in {topic_title or 'this topic'}.")
    hint = question_data.get("hint", f"Review the core definition and constraints.")
    prerequisite = question_data.get("prerequisite_topic", f"Prerequisites for {topic_title or 'this topic'}")

    return {
        "is_correct": is_correct,
        "correct_answer": correct_text or correct_answer or "",
        "correct_index": correct_idx,
        "explanation": explanation,
        "mistake_analysis": mistake_analysis if not is_correct else None,
        "hint": hint,
        "prerequisite_topic": prerequisite if not is_correct else None,
        "mastery_points": 10 if is_correct else -2
    }


# =============================================================================
# 5. Smart Recovery Planner (Automatic Replanning for Missed Days)
# =============================================================================

def calculate_smart_recovery_plan(
    exam_name: str = "Target Examination",
    exam_date_str: Optional[str] = None,
    current_tasks: Optional[List[Dict[str, Any]]] = None,
    daily_available_hours: float = 3.0,
    sitting_capacity_mins: int = 45,
    available_days: Optional[List[str]] = None,
    missed_tasks: Optional[List[Dict[str, Any]]] = None,
    remaining_topics: Optional[List[Dict[str, Any]]] = None,
    exam_date: Optional[str] = None,
    daily_hours: Optional[float] = None,
    **kwargs
) -> Dict[str, Any]:
    """
    Recognizes missed or postponed study sessions, recalculates remaining workload,
    determines time left until the exam, prioritizes high-yield & weak topics,
    and redistributes tasks realistically without burning out the user.
    """
    today_dt = datetime.now().date()
    today_str = today_dt.strftime("%Y-%m-%d")

    if exam_date is not None and exam_date_str is None:
        exam_date_str = exam_date
    if daily_hours is not None:
        daily_available_hours = daily_hours

    explicit_missed = None
    if missed_tasks is not None:
        explicit_missed = list(missed_tasks)
    if current_tasks is None:
        current_tasks = (missed_tasks or []) + (remaining_topics or [])

    # Parse exam date
    if exam_date_str:
        try:
            exam_dt = datetime.strptime(exam_date_str[:10], "%Y-%m-%d").date()
        except Exception:
            exam_dt = today_dt + timedelta(days=30)
    else:
        exam_dt = today_dt + timedelta(days=30)

    days_remaining = max(1, (exam_dt - today_dt).days)

    # Detect missed tasks: scheduled for a date strictly before today and still pending
    missed_tasks = []
    future_tasks = []
    completed_tasks = []

    if explicit_missed is not None:
        missed_tasks = explicit_missed
        future_tasks = [t for t in current_tasks if t not in missed_tasks and t.get("status") != "completed"]
    else:
        for t in current_tasks:
            t_date = t.get("scheduled_date") or t.get("date") or today_str
            is_done = t.get("status") == "completed" or t.get("done") is True

            if is_done:
                completed_tasks.append(t)
            elif t_date < today_str:
                missed_tasks.append(t)
            else:
                future_tasks.append(t)

    missed_count = len(missed_tasks)

    # Total remaining workload in minutes
    missed_mins = sum(t.get("estimated_minutes") or t.get("mins") or 45 for t in missed_tasks)
    future_mins = sum(t.get("estimated_minutes") or t.get("mins") or 45 for t in future_tasks)
    total_remaining_mins = missed_mins + future_mins

    daily_mins_capacity = int(daily_available_hours * 60)
    total_available_study_mins = days_remaining * daily_mins_capacity

    # Reserve 25% of final days for mock tests and revision buffer
    revision_buffer_days = max(2, int(days_remaining * 0.25))
    learning_days_available = max(1, days_remaining - revision_buffer_days)
    learning_capacity_mins = learning_days_available * daily_mins_capacity

    is_feasible = (total_remaining_mins <= learning_capacity_mins)
    required_daily_hours = round((total_remaining_mins / max(1, learning_days_available)) / 60, 1)

    # Sort missed tasks by priority (high priority first)
    priority_weight = {"high": 3, "medium": 2, "low": 1}
    sorted_missed = sorted(
        missed_tasks,
        key=lambda x: priority_weight.get(str(x.get("priority", "medium")).lower(), 2),
        reverse=True
    )

    # Redistribute tasks into available future dates
    rescheduled_moves = []
    assigned_day_offset = 0

    # Weekday filter (case-insensitive & 3-letter prefix)
    allowed_set = set(d.strip().lower()[:3] for d in (available_days or ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]))
    weekday_map = {0: "mon", 1: "tue", 2: "wed", 3: "thu", 4: "fri", 5: "sat", 6: "sun"}

    for idx, mt in enumerate(sorted_missed):
        # Find next valid weekday
        loop_guard = 0
        while loop_guard < 365:
            target_date = today_dt + timedelta(days=assigned_day_offset)
            if weekday_map[target_date.weekday()] in allowed_set:
                break
            assigned_day_offset += 1
            loop_guard += 1

        target_date_str = target_date.strftime("%Y-%m-%d")
        t_id = mt.get("id", f"task_{idx}")
        t_name = mt.get("topic_name") or mt.get("title") or "Scheduled Topic"
        old_date = mt.get("scheduled_date") or mt.get("date") or "Past Date"

        rescheduled_moves.append({
            "task_id": t_id,
            "topic_name": t_name,
            "subject_name": mt.get("subject_name") or "General",
            "old_date": old_date,
            "new_date": target_date_str,
            "estimated_minutes": mt.get("estimated_minutes") or mt.get("mins") or 45,
            "priority": mt.get("priority", "medium"),
            "reason": "Rescheduled from missed date to preserve syllabus coverage"
        })

        # Distribute at most 2-3 sessions per day to avoid burnout
        if (idx + 1) % 2 == 0:
            assigned_day_offset += 1
            if assigned_day_offset >= learning_days_available:
                assigned_day_offset = learning_days_available - 1

    trade_offs = []
    recommendations = []

    if not is_feasible:
        trade_offs.append(f"At current pace, covering all {len(missed_tasks) + len(future_tasks)} remaining tasks requires {required_daily_hours} hrs/day, exceeding your {daily_available_hours} hrs/day preference.")
        trade_offs.append("Low-priority drill topics will be compressed into summary revision sessions.")
        recommendations.append(f"Consider temporarily boosting daily study time from {daily_available_hours} hrs to {min(daily_available_hours + 1.5, required_daily_hours)} hrs.")
        recommendations.append("Protect the 25% final revision buffer for full-length mock tests.")
    else:
        recommendations.append("All missed sessions successfully distributed across upcoming days without exceeding your daily hours.")
        recommendations.append("Full revision buffer (mock tests & active recall) remains completely intact.")

    feasibility_analysis = {
        "is_feasible": is_feasible,
        "days_remaining_to_exam": days_remaining,
        "revision_buffer_days": revision_buffer_days,
        "effective_learning_days": learning_days_available,
        "total_remaining_workload_hours": round(total_remaining_mins / 60, 1),
        "current_daily_capacity_hours": daily_available_hours,
        "required_daily_hours": required_daily_hours,
        "trade_offs": trade_offs,
        "recommendations": recommendations,
        "explanation": (
            f"You have {days_remaining} days until {exam_name}. We detected {missed_count} missed study sessions ({round(missed_mins / 60, 1)} hrs). "
            f"Rather than piling everything into tomorrow, StudyPilot redistributed your high-priority topics across future sessions while protecting your final {revision_buffer_days}-day revision buffer."
        )
    }

    return {
        "plan_id": f"rec_{secrets.token_hex(6)}",
        "exam_name": exam_name,
        "missed_days_count": max(1, missed_count // 2) if missed_count > 0 else 0,
        "missed_tasks_count": missed_count,
        "missed_task_ids": [t.get("id") for t in missed_tasks],
        "rescheduled_tasks": rescheduled_moves,
        "feasibility_analysis": feasibility_analysis,
        "analysis_summary": feasibility_analysis["explanation"],
        "created_at": datetime.now().isoformat()
    }


# =============================================================================
# 6. AI Exam Trend Analyzer & Important Topics Engine
# =============================================================================

def compute_pyp_trend_analysis(
    exam_id: str = "",
    syllabus_subjects: Optional[List[Dict[str, Any]]] = None,
    syllabus_topics: Optional[List[Dict[str, Any]]] = None,
    pyp_papers: Optional[List[Dict[str, Any]]] = None,
    pyp_questions: Optional[List[Dict[str, Any]]] = None,
    user_weak_topic_ids: Optional[List[str]] = None,
    user_weak_topics: Optional[List[str]] = None,
    **kwargs
) -> List[Dict[str, Any]]:
    """
    Examines previous-year papers against syllabus topics.
    Calculates exact historical question frequency, assigns categories:
    - High historical frequency
    - Moderate historical frequency
    - Lower historical frequency
    - Important syllabus fundamentals
    - Weak areas for current user
    """
    user_weak_set = set(user_weak_topic_ids or user_weak_topics or [])
    papers_list = pyp_papers or []
    num_papers = max(1, len(papers_list))
    questions_list = pyp_questions or []
    total_extracted_q = max(1, len(questions_list))

    # Count question occurrences per topic
    topic_counts: Dict[str, int] = {}
    topic_years: Dict[str, set] = {}

    for q in questions_list:
        tid = q.get("topic_id")
        tname = q.get("topic_name")
        paper_id = q.get("paper_id")
        paper_year = q.get("year")
        
        if not paper_year and papers_list:
            p_match = next((p for p in papers_list if p.get("id") == paper_id), None)
            paper_year = p_match.get("year", 2024) if p_match else 2024
        elif not paper_year:
            paper_year = 2024

        key = tid or tname
        if key:
            topic_counts[key] = topic_counts.get(key, 0) + 1
            if key not in topic_years:
                topic_years[key] = set()
            topic_years[key].add(paper_year)

    # Flatten syllabus topics
    flat_topics: List[Dict[str, Any]] = []
    if syllabus_topics:
        for t in syllabus_topics:
            flat_topics.append({
                "topic_id": t.get("topic_id") or t.get("id"),
                "topic_name": t.get("topic_name") or t.get("name") or "Topic",
                "subject_name": t.get("subject_name") or "General",
                "importance": t.get("importance") or "medium"
            })
    elif syllabus_subjects:
        for s in syllabus_subjects:
            s_name = s.get("subject_name") or s.get("name") or "Subject"
            for u in s.get("units", []):
                for c in u.get("chapters", []):
                    for t in c.get("topics", []):
                        flat_topics.append({
                            "topic_id": t.get("id") or t.get("topic_id"),
                            "topic_name": t.get("topic_name") or t.get("name") or "Topic",
                            "subject_name": s_name,
                            "importance": t.get("importance") or "medium"
                        })

    results = []
    for t in flat_topics:
        tid = t.get("topic_id")
        tname = t.get("topic_name") or "Topic"
        s_name = t.get("subject_name") or "General"
        
        freq = topic_counts.get(tid) or topic_counts.get(tname) or 0
        years = sorted(list(topic_years.get(tid) or topic_years.get(tname) or set()))
        weightage = round((freq / total_extracted_q) * 100, 1)

        # Categorization logic
        if tid in user_weak_set or tname in user_weak_set:
            cat = "weak_spot"
            rec = "Target with intensive practice; frequent error source in past tests."
            notes = f"Appeared {freq} times in PYPs ({', '.join(str(y) for y in years) if years else 'various years'}). High priority due to recent test mistakes."
        elif freq >= 3:
            cat = "high"
            rec = "Must-master topic! Consistently tested across multiple exam cycles."
            notes = f"Appeared in {len(years) or 1} of {num_papers} analyzed papers ({', '.join(str(y) for y in years) if years else 'recent cycles'}). Contributes ~{weightage}% of paper weightage."
        elif freq >= 2:
            cat = "moderate"
            rec = "Core scoring topic. Regularly tested with moderate variation in question types."
            notes = f"Appeared {freq} times across {', '.join(str(y) for y in years) if years else 'recent cycles'}. Standard application questions are common."
        elif freq == 1:
            cat = "lower"
            rec = "Review fundamentals and standard formulas; lower historical question volume."
            notes = f"Appeared in paper year {years[0] if years else 'past cycle'}. Do not ignore, but prioritize higher-frequency topics first."
        else:
            if t.get("importance") == "high":
                cat = "fundamental"
                rec = "Foundational syllabus concept! Even without direct PYP questions, prerequisites depend on it."
                notes = "Essential conceptual stepping stone required for higher-order topics in this unit."
            else:
                cat = "insufficient_data"
                rec = "Standard syllabus coverage. Maintain regular study without over-indexing."
                notes = f"Not directly extracted from the {num_papers} analyzed previous-year papers."

        results.append({
            "id": f"trend_{tid or secrets.token_hex(4)}",
            "exam_id": exam_id,
            "topic_id": tid or f"top_{secrets.token_hex(4)}",
            "subject_name": s_name,
            "topic_name": tname,
            "frequency_count": freq,
            "frequency_category": cat,
            "importance_category": cat,
            "years_appeared": years,
            "weightage_percentage": weightage,
            "weightage_percent": weightage,
            "weightage_score": weightage,
            "evidence_notes": notes,
            "recommended_action": rec
        })

    # Sort: weak spots & high first, then moderate, fundamental, lower, insufficient_data
    order_map = {"weak_spot": 0, "high": 1, "moderate": 2, "fundamental": 3, "lower": 4, "insufficient_data": 5}
    results.sort(key=lambda x: (order_map.get(x["frequency_category"], 5), -x["frequency_count"]))
    return results


# =============================================================================
# 7. AI Predicted Practice Paper Generator
# =============================================================================

async def generate_predicted_practice_paper_content(
    exam_name: str,
    education_level: str = "competitive",
    syllabus: Optional[List[Dict[str, Any]]] = None,
    trend_data: Optional[List[Dict[str, Any]]] = None,
    user_weak_topics: Optional[List[str]] = None,
    mode: str = "exam_pattern",
    num_questions: int = 20,
    duration_mins: int = 60,
    api_key: Optional[str] = None,
    topics: Optional[List[Dict[str, Any]]] = None,
    generation_mode: Optional[str] = None,
    weak_topics: Optional[List[str]] = None,
    subject_name: Optional[str] = None,
    **kwargs
) -> Dict[str, Any]:
    """
    Generates syllabus-based practice papers informed by historical examination patterns:
    Modes:
    - exam_pattern: Mimics the configured examination format.
    - high_priority: Focuses on historically recurring topics.
    - full_syllabus: Balanced coverage across all subjects.
    - weak_areas: Targets user's lower-performing topics.
    - revision_paper: Covers previously studied material.
    - last_minute: Essential high-yield concepts within time remaining.
    """
    if syllabus is None and topics is not None:
        syllabus = topics
    if syllabus is None:
        syllabus = []
    if trend_data is None:
        trend_data = []
    if user_weak_topics is None and weak_topics is not None:
        user_weak_topics = weak_topics
    if user_weak_topics is None:
        user_weak_topics = []
    if generation_mode is not None:
        mode = generation_mode
    profile = get_level_profile(education_level)
    level_name = profile["name"]
    q_count = max(5, min(50, num_questions))

    # Mode title & emphasis
    mode_titles = {
        "exam_pattern": f"🎯 Standard Examination Pattern Predicted Paper ({exam_name})",
        "high_priority": f"🔥 High-Yield & Historically Recurring Topics Paper ({exam_name})",
        "full_syllabus": f"🌐 Comprehensive Full-Syllabus Predicted Paper ({exam_name})",
        "weak_areas": f"💡 Weak-Area Reinforcement & Diagnostic Paper ({exam_name})",
        "revision_paper": f"🔁 Spaced Retention Revision Practice Paper ({exam_name})",
        "last_minute": f"⚡ Last-Minute High-Impact Essentials Paper ({exam_name})"
    }
    title = mode_titles.get(mode, f"AI Predicted Practice Paper — {exam_name}")

    # Gather priority topics based on mode
    priority_topics = []
    if mode == "weak_areas" and user_weak_topics:
        priority_topics = user_weak_topics[:q_count]
    elif mode == "high_priority":
        priority_topics = [t["topic_name"] for t in trend_data if t.get("frequency_category") in ["high", "moderate"]][:q_count]

    if not priority_topics:
        # Fallback to general topics across syllabus
        for s in syllabus:
            s_name = s.get("subject_name") or s.get("name") or "Subject"
            for u in s.get("units", []):
                for c in u.get("chapters", []):
                    for t in c.get("topics", []):
                        priority_topics.append(t.get("topic_name") or t.get("name") or "Topic")

    if not priority_topics:
        priority_topics = [f"{exam_name} Core Concept {i+1}" for i in range(q_count)]

    # Generate questions using LLM or heuristic generator
    system_instruction = (
        f"You are StudyPilot's Examination Prediction Engine. "
        f"Generate a balanced {q_count}-question predicted paper for {exam_name} at {level_name} level. "
        f"Mode: {mode}. Return ONLY a JSON list of questions."
    )

    prompt = f"""
    Create {q_count} questions for predicted practice paper:
    Exam: "{exam_name}"
    Level: "{level_name}"
    Mode: "{mode}"
    Target Topics: {priority_topics[:15]}

    Return ONLY a JSON array with objects matching:
    [
        {{
            "id": "pred_q_1",
            "question_text": "High-yield examination style question...",
            "options": ["Option A", "Option B", "Option C", "Option D"],
            "correct_answer": "Option B",
            "correct_index": 1,
            "explanation": "Thorough step-by-step solution...",
            "topic_name": "Topic from target list",
            "subject_name": "Subject Name",
            "marks": 2.0,
            "negative_marks": 0.5,
            "difficulty": "exam_level"
        }}
    ]
    """

    llm_output = await call_llm(prompt, api_key=api_key, system_instruction=system_instruction, json_mode=True)
    questions = []
    if llm_output:
        try:
            cleaned = llm_output.strip()
            if cleaned.startswith("```json"):
                cleaned = cleaned[7:]
            if cleaned.startswith("```"):
                cleaned = cleaned[3:]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            parsed = json.loads(cleaned.strip())
            if isinstance(parsed, dict) and "questions" in parsed:
                parsed = parsed["questions"]
            if isinstance(parsed, list) and len(parsed) > 0:
                questions = parsed
        except Exception:
            pass

    if not questions:
        # Heuristic Generator
        used_qs = set()
        for i in range(q_count):
            t_name = priority_topics[i % len(priority_topics)]
            q = generate_heuristic_question(
                topic_name=t_name,
                subject_name="General",
                question_index=i + 1,
                total_requested=q_count,
                used_questions=used_qs,
                difficulty="moderate"
            )
            q["id"] = f"pred_q_{i+1}_{secrets.token_hex(2)}"
            q["topic_name"] = t_name
            q["subject_name"] = "Core Syllabus"
            q["marks"] = 2.0
            q["negative_marks"] = 0.5
            questions.append(q)

    total_marks = sum(q.get("marks", 2.0) for q in questions)

    return {
        "id": f"pred_{secrets.token_hex(6)}",
        "title": title,
        "generation_mode": mode,
        "education_level": education_level,
        "exam_name": exam_name,
        "duration_minutes": duration_mins,
        "total_questions": len(questions),
        "total_marks": total_marks,
        "negative_marking_enabled": True,
        "disclaimer": "AI-generated predicted practice paper — not an official examination paper or a guaranteed prediction of the upcoming exam. Historical patterns are evidence for practice planning, not a guarantee of future questions.",
        "questions": questions,
        "created_at": datetime.now().isoformat()
    }

