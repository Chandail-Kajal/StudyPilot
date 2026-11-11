from manim import *

class TopicAnimation(Scene):
    def construct(self):
        title = Text("Circular Queue and Stack Implementations", font_size=34, color=BLUE)
        self.play(Write(title))
        self.wait(1)
        eq = MathTex(r"\Phi = \oint ec{E} \cdot dec{A}", font_size=40, color=YELLOW)
        self.play(Transform(title, eq))
        self.wait(2)
