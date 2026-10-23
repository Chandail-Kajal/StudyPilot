import os
import json
import random
import secrets
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
import httpx

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
    """Universal dispatcher for available AI APIs."""
    key = get_api_key(api_key)
    if not key:
        return None
    try:
        if is_openai_key(key):
            return await call_openai(prompt, key, system_instruction, json_mode)
        else:
            return await call_gemini(prompt, key, system_instruction, json_mode)
    except Exception as e:
        print(f"[AI Service Warning] LLM call failed: {e}. Falling back to intelligent heuristic engine.")
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
    used_questions: Optional[set] = None
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
    base_idx = (question_index + abs(hash(topic_name))) % total_archetypes

    selected = archetypes[base_idx]
    q_text = selected["q"]
    counter = 1
    while q_text in used_questions and counter < total_archetypes:
        next_idx = (base_idx + counter) % total_archetypes
        selected = archetypes[next_idx]
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
        "difficulty": "medium"
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
    
    # If importance_filter is specified, filter topics
    if importance_filter == "very_important":
        filtered_topics = [t for t in topics if get_topic_importance(t.get("name", ""))["importance"] == "very_important"]
        if filtered_topics:
            topics = filtered_topics

    topic_names = [t.get("name", "Core Topic") for t in topics]
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
