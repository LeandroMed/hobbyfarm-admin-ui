import { HttpErrorResponse } from '@angular/common/http';
import { Component, EventEmitter, Input, OnChanges, OnInit, Output, ViewChild } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ClrWizard } from '@clr/angular';
import { AlertComponent } from 'src/app/alert/alert.component';
import { CloudInitConfig } from 'src/app/data/cloud-init-config';
import { ServerResponse } from 'src/app/data/serverresponse';
import { vmServiceToJSON } from 'src/app/data/vm-template-service-configuration';
import { VMTemplate } from 'src/app/data/vmtemplate';
import { VmtemplateService } from 'src/app/data/vmtemplate.service';
import * as uuid from 'uuid'

@Component({
  selector: 'edit-vmtemplate-wizard',
  templateUrl: './edit-vmtemplate.component.html',
  styleUrls: ['./edit-vmtemplate.component.scss']
})
export class EditVmtemplateComponent implements OnInit, OnChanges {
  public templateDetails: FormGroup;
  public configMap: FormGroup;
  public buttonsDisabled: boolean = false;

  public cloudConfigKey: string = 'cloud-config'
  public vmServiceKey: string = 'webinterfaces'
  public cloudConfig: CloudInitConfig = new CloudInitConfig();   

  @Input()
  public editTemplate: VMTemplate;  

  @Output()
  public event: EventEmitter<boolean> = new EventEmitter(false);

  public template: VMTemplate = new VMTemplate();
  public selectWebinterfaceModalOpen: boolean = false
  public newWebinterfaceModalOpen: boolean = false


  constructor(
    private _fb: FormBuilder,
    private vmTemplateService: VmtemplateService
  ) { }

  ngOnInit(): void {
    this._build();
  }

  @ViewChild("wizard", {static: true}) wizard: ClrWizard;
  @ViewChild("alert") alert: AlertComponent;

  public open() {
    this.template = new VMTemplate();
    this.buttonsDisabled = false;
    this._build();
    this.wizard.reset();
    if (this.editTemplate) {
      this._prepare();
    }
    this.wizard.open();
  }

  private _build() {
    this.buildConfigMap();
    this.buildTemplateDetails();
  }

  public buildTemplateDetails(edit: boolean = false) {
    this.templateDetails = null;
    this.templateDetails = this._fb.group({
      name: [edit ? this.editTemplate.name : '', [Validators.required, Validators.minLength(4)]],
      image: [edit ? this.editTemplate.image : '', [Validators.required]]
    })
  }

  public buildConfigMap() {
    this.configMap = this._fb.group({
      mappings: this._fb.array([
        this._fb.group({
          key: ['', Validators.required],
          value: ['', Validators.required]
        })
      ])
    })
  }

  private buildVMServices(configMapData?: string) {
    if (configMapData) {
      let temp = JSON.parse(configMapData)
      let resultMap = new Map()
      temp.forEach(entry => {
        entry.cloudConfigMap = new Map(Object.entries(entry["cloudConfigMap"])); // Convert Object to map
        entry['id'] = entry['id'] ?? uuid.v4() //Catch old entries, that do not have an ID 
        resultMap.set(entry['id'], entry)
      })
      return resultMap
    }
    else return new Map()
  }

  public prepareConfigMap() {
    // differs from buildConfigMap() in that we are copying existing values
    // into the form
    let configKeys = Object.keys(this.editTemplate.config_map).filter(elem => elem !== this.cloudConfigKey && elem != this.vmServiceKey)
    this.cloudConfig.vmServices = this.buildVMServices(this.editTemplate.config_map[this.vmServiceKey])
    this.cloudConfig.buildNewYAMLFile()
    this.configMap = this._fb.group({
      mappings: this._fb.array([])
    });

    for (var i = 0; i < configKeys.length; i++) {
      this.newConfigMapping(configKeys[i], this.editTemplate.config_map[configKeys[i]]);
    }
  }

  public fixNullValues() {
    if (this.editTemplate.config_map == null) {
      this.editTemplate.config_map = {};
    }
  }

  public newConfigMapping(key: string = '', value: string = '') {
    var newGroup = this._fb.group({
      key:    [key, Validators.required],
      value:  [value, Validators.required]
    });
    (this.configMap.get('mappings') as FormArray).push(newGroup)
  }

  public deleteConfigMapping(mappingIndex: number) {
    (this.configMap.get('mappings') as FormArray).removeAt(mappingIndex);
  }

  public copyTemplateDetails() {
    this.template.name = this.templateDetails.get('name').value;
    this.template.image = this.templateDetails.get('image').value;
  }

  public copyConfigMap() {
    this.template.config_map = {};
    for (var i = 0; i < (this.configMap.get('mappings') as FormArray).length; i++) {
      var key = (this.configMap.get(['mappings', i]) as FormGroup).get('key').value;
      var value = (this.configMap.get(['mappings', i]) as FormGroup).get('value').value
      this.template.config_map[key] = value;
    }
    this.template.config_map[this.cloudConfigKey] = this.cloudConfig.cloudConfigYaml;  
    let tempArray = []
    this.cloudConfig.vmServices.forEach(vmService => {
      //tempArray.push(vmService);
      tempArray.push(JSON.parse(vmServiceToJSON(vmService)))
    })
    let jsonString = JSON.stringify(tempArray)
    this.template.config_map[this.vmServiceKey] = jsonString
  }
  public copyTemplate() {
    this.copyConfigMap();
    this.copyTemplateDetails();
  }

  public saveTemplate() {
    this.buttonsDisabled = true;
    if (this.editTemplate) {
      this.template.id = this.editTemplate.id;
      this.vmTemplateService.update(this.template)
      .subscribe(
        (s: ServerResponse) => {
          this.alert.success("VM Template saved", false, 1000)
          this.event.next(true);
          setTimeout(() => this.wizard.close(), 1000);
        },
        (e: HttpErrorResponse) => {
          this.alert.danger("Error saving VM Template: " + e.error.message, false, 3000);
          this.buttonsDisabled = false;
        }
      )
    } else {
      this.vmTemplateService.create(this.template)
      .subscribe(
        (s: ServerResponse) => {
          this.alert.success("VM Template saved", false, 1000)
          this.event.next(true);
          setTimeout(() => this.wizard.close(), 1000);
        },
        (e: HttpErrorResponse) => {
          this.alert.danger("Error saving VM Template: " + e.error.message, false, 3000);
          this.buttonsDisabled = false;
        }
      )
    }
  }

  private _prepare() {
    this.buildTemplateDetails(true);
    this.prepareConfigMap();
  }

  ngOnChanges() {
    if (this.editTemplate) {
      this.fixNullValues();
      this._prepare();
      this.wizard.navService.goTo(this.wizard.pages.last, true);
      this.wizard.pages.first.makeCurrent();
    } else {
      this.buildTemplateDetails();
      this.buildConfigMap();
    }
  }
}