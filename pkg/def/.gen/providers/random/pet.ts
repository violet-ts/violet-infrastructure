// https://www.terraform.io/docs/providers/random/r/pet.html
// generated from terraform resource schema

import { Construct } from 'constructs';
import * as cdktf from 'cdktf';

// Configuration

export interface PetConfig extends cdktf.TerraformMetaArguments {
  /**
  * Arbitrary map of values that, when changed, will trigger recreation of resource. See [the main provider documentation](../index.html) for more information.
  * 
  * Docs at Terraform Registry: {@link https://www.terraform.io/docs/providers/random/r/pet.html#keepers Pet#keepers}
  */
  readonly keepers?: { [key: string]: string } | cdktf.IResolvable;
  /**
  * The length (in words) of the pet name.
  * 
  * Docs at Terraform Registry: {@link https://www.terraform.io/docs/providers/random/r/pet.html#length Pet#length}
  */
  readonly length?: number;
  /**
  * A string to prefix the name with.
  * 
  * Docs at Terraform Registry: {@link https://www.terraform.io/docs/providers/random/r/pet.html#prefix Pet#prefix}
  */
  readonly prefix?: string;
  /**
  * The character to separate words in the pet name.
  * 
  * Docs at Terraform Registry: {@link https://www.terraform.io/docs/providers/random/r/pet.html#separator Pet#separator}
  */
  readonly separator?: string;
}

/**
* Represents a {@link https://www.terraform.io/docs/providers/random/r/pet.html random_pet}
*/
export class Pet extends cdktf.TerraformResource {

  // =================
  // STATIC PROPERTIES
  // =================
  public static readonly tfResourceType: string = "random_pet";

  // ===========
  // INITIALIZER
  // ===========

  /**
  * Create a new {@link https://www.terraform.io/docs/providers/random/r/pet.html random_pet} Resource
  *
  * @param scope The scope in which to define this construct
  * @param id The scoped construct ID. Must be unique amongst siblings in the same scope
  * @param options PetConfig = {}
  */
  public constructor(scope: Construct, id: string, config: PetConfig = {}) {
    super(scope, id, {
      terraformResourceType: 'random_pet',
      terraformGeneratorMetadata: {
        providerName: 'random'
      },
      provider: config.provider,
      dependsOn: config.dependsOn,
      count: config.count,
      lifecycle: config.lifecycle
    });
    this._keepers = config.keepers;
    this._length = config.length;
    this._prefix = config.prefix;
    this._separator = config.separator;
  }

  // ==========
  // ATTRIBUTES
  // ==========

  // id - computed: true, optional: false, required: false
  public get id() {
    return this.getStringAttribute('id');
  }

  // keepers - computed: false, optional: true, required: false
  private _keepers?: { [key: string]: string } | cdktf.IResolvable | undefined; 
  public get keepers() {
    // Getting the computed value is not yet implemented
    return this.interpolationForAttribute('keepers') as any;
  }
  public set keepers(value: { [key: string]: string } | cdktf.IResolvable | undefined) {
    this._keepers = value;
  }
  public resetKeepers() {
    this._keepers = undefined;
  }
  // Temporarily expose input value. Use with caution.
  public get keepersInput() {
    return this._keepers
  }

  // length - computed: false, optional: true, required: false
  private _length?: number | undefined; 
  public get length() {
    return this.getNumberAttribute('length');
  }
  public set length(value: number | undefined) {
    this._length = value;
  }
  public resetLength() {
    this._length = undefined;
  }
  // Temporarily expose input value. Use with caution.
  public get lengthInput() {
    return this._length
  }

  // prefix - computed: false, optional: true, required: false
  private _prefix?: string | undefined; 
  public get prefix() {
    return this.getStringAttribute('prefix');
  }
  public set prefix(value: string | undefined) {
    this._prefix = value;
  }
  public resetPrefix() {
    this._prefix = undefined;
  }
  // Temporarily expose input value. Use with caution.
  public get prefixInput() {
    return this._prefix
  }

  // separator - computed: false, optional: true, required: false
  private _separator?: string | undefined; 
  public get separator() {
    return this.getStringAttribute('separator');
  }
  public set separator(value: string | undefined) {
    this._separator = value;
  }
  public resetSeparator() {
    this._separator = undefined;
  }
  // Temporarily expose input value. Use with caution.
  public get separatorInput() {
    return this._separator
  }

  // =========
  // SYNTHESIS
  // =========

  protected synthesizeAttributes(): { [name: string]: any } {
    return {
      keepers: cdktf.hashMapper(cdktf.anyToTerraform)(this._keepers),
      length: cdktf.numberToTerraform(this._length),
      prefix: cdktf.stringToTerraform(this._prefix),
      separator: cdktf.stringToTerraform(this._separator),
    };
  }
}
