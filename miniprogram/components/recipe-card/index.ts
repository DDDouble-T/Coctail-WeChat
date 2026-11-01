import { RecipeCard } from '../../utils/view-model';
import { openRecipe } from '../../services/clicks';

Component({
  properties: { card: { type: Object, value: {} as RecipeCard }, version: { type: String, value: '' } },
  methods: {
    open() { openRecipe(this.data.card.id); },
  },
});
